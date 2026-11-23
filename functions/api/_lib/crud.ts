import { syncSettingApartInterviews } from '../jobs';
import { TABLES } from './access';
import { type Ctx, type Session, checkConflict, isForeignKeyConstraintError, isUniqueConstraintError, json, keepKnownColumns } from './core';
import { linkCallingMember, logCallingPipelineHistory, scheduleClash, syncMemberCareFromMoveIns } from './domain';

// Generic CRUD for every table in TABLES: /api/{table} and /api/{table}/{id}.
export async function handleCrud(ctx: Ctx, session: Session): Promise<Response> {
  const { request, db, routeParts, method, waitUntil } = ctx;
  if (routeParts[0] === 'calling-pipeline' && routeParts[2] === 'history' && method === 'GET') {
    const results = await db.prepare(
      'SELECT * FROM calling_pipeline_history WHERE calling_id = ? ORDER BY changed_at DESC, id DESC'
    ).bind(routeParts[1]).all();
    return json(results.results);
  }

  // CRUD endpoints: /api/{table} and /api/{table}/{id}
  const tableName = routeParts[0];
  const recordId = routeParts[1];
  const tableConfig = TABLES[tableName];

  if (!tableConfig) return json({ error: 'Unknown table' }, 404);

  if (tableName === 'member-care' && method === 'GET' && !recordId) {
    await syncMemberCareFromMoveIns(db).catch(err => console.error('member-care sync failed:', err));
    const { results } = await db.prepare(`SELECT * FROM member_care WHERE deleted = 0 ORDER BY ${tableConfig.orderBy}`).all();
    return json(results);
  }

  // Deleting a row that came from a bishopric-meeting move-in leaves a hidden tombstone,
  // so the move-in sync doesn't add the person straight back.
  if (tableName === 'member-care' && method === 'DELETE' && recordId) {
    const row = await db.prepare('SELECT move_item_id FROM member_care WHERE id = ?').bind(recordId).first<{ move_item_id: number | null }>();
    if (row?.move_item_id) {
      await db.prepare('UPDATE member_care SET deleted = 1, updated_at = ?, updated_by = ? WHERE id = ?')
        .bind(new Date().toISOString(), session.name, recordId).run();
      return json({ ok: true });
    }
  }

  // A booked interview slot owns the appointment it put on the calendar: deleting the
  // slot, or clearing its booking, removes that appointment too.
  if (tableName === 'interview-slots' && recordId && (method === 'DELETE' || method === 'PUT')) {
    const slot = await db.prepare('SELECT schedule_entry_id FROM interview_slots WHERE id = ?').bind(recordId)
      .first<{ schedule_entry_id: number | null }>();
    if (slot?.schedule_entry_id) {
      let clearing = method === 'DELETE';
      if (method === 'PUT') {
        const peek = await request.clone().json().catch(() => ({})) as Record<string, unknown>;
        clearing = 'reserved_by' in peek && !peek.reserved_by;
      }
      if (clearing) {
        await db.batch([
          db.prepare('DELETE FROM schedule_entries WHERE id = ?').bind(slot.schedule_entry_id),
          db.prepare('UPDATE interview_slots SET schedule_entry_id = NULL WHERE id = ?').bind(recordId),
        ]);
      }
    }
  }

  if (method === 'GET' && !recordId) {
    const results = await db.prepare(
      `SELECT * FROM ${tableConfig.name} ORDER BY ${tableConfig.orderBy || 'id DESC'}`
    ).all();
    return json(results.results);
  }

  if (method === 'GET' && recordId) {
    const row = await db.prepare(
      `SELECT * FROM ${tableConfig.name} WHERE id = ?`
    ).bind(recordId).first();
    if (!row) return json({ error: 'Not found' }, 404);
    return json(row);
  }

  if (method === 'POST') {
    const body = await request.json() as Record<string, unknown>;
    delete body.updated_by;
    body.updated_by = session.name;
    // Who added the row (only kept on tables with a created_by column). A copy
    // of an earlier row (e.g. agenda items carried over from the prior
    // meeting) may pass its original adder along.
    if (typeof body.created_by !== 'string' || !body.created_by.trim()) body.created_by = session.name;
    if (tableName === 'calling-pipeline') await linkCallingMember(db, body);
    const clash = await scheduleClash(db, tableName, body);
    if (clash) return clash;
    await keepKnownColumns(db, tableConfig.name, body);
    const keys = Object.keys(body);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => body[k]);

    let result;
    try {
      result = await db.prepare(
        `INSERT INTO ${tableConfig.name} (${keys.join(', ')}) VALUES (${placeholders})`
      ).bind(...values).run();
    } catch (e) {
      if (isUniqueConstraintError(e)) return json({ error: 'A record already exists for this person — edit the existing one instead.' }, 409);
      throw e;
    }

    const newRow = await db.prepare(
      `SELECT * FROM ${tableConfig.name} WHERE id = ?`
    ).bind(result.meta.last_row_id).first();
    if (tableName === 'calling-pipeline') {
      waitUntil(syncSettingApartInterviews(db).catch(() => {}));
      waitUntil(logCallingPipelineHistory(db, result.meta.last_row_id as number, null, body, session.name, new Date().toISOString()).catch(() => {}));
    }
    return json(newRow, 201);
  }

  if (method === 'PUT' && recordId) {
    const body = await request.json() as Record<string, unknown>;
    const baseUpdatedAt = body._base_updated_at as string | null | undefined;
    delete body._base_updated_at;
    delete body.updated_at;
    delete body.updated_by;
    delete body.created_by;

    if (baseUpdatedAt) {
      const conflictCheck = await checkConflict(db, tableConfig.name, recordId, baseUpdatedAt);
      if (conflictCheck) return conflictCheck;
    }

    const beforeUpdate = tableName === 'calling-pipeline'
      ? await db.prepare('SELECT * FROM calling_pipeline WHERE id = ?').bind(recordId).first<Record<string, unknown>>()
      : null;

    const clash = await scheduleClash(db, tableName, body, recordId);
    if (clash) return clash;

    body.updated_at = new Date().toISOString();
    body.updated_by = session.name;
    if (tableName === 'calling-pipeline') await linkCallingMember(db, body);
    await keepKnownColumns(db, tableConfig.name, body);
    const keys = Object.keys(body);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => body[k]);

    try {
      await db.prepare(
        `UPDATE ${tableConfig.name} SET ${setClause} WHERE id = ?`
      ).bind(...values, recordId).run();
    } catch (e) {
      if (isUniqueConstraintError(e)) return json({ error: 'A record already exists for this person — edit the existing one instead.' }, 409);
      throw e;
    }

    const updated = await db.prepare(
      `SELECT * FROM ${tableConfig.name} WHERE id = ?`
    ).bind(recordId).first();
    if (tableName === 'calling-pipeline') {
      waitUntil(syncSettingApartInterviews(db).catch(() => {}));
      waitUntil(logCallingPipelineHistory(db, Number(recordId), beforeUpdate, body, session.name, body.updated_at as string).catch(() => {}));
    }
    if (tableName === 'interview-pipeline') {
      const row = updated as { type_of_interview?: string; status?: string; calling_id?: number | null } | null;
      if (row?.type_of_interview === 'Setting Apart' && row.status === 'Complete' && row.calling_id) {
        waitUntil(db.prepare(
          "UPDATE calling_pipeline SET status = '6. Set apart', updated_at = ? WHERE id = ? AND status = '5. Sustained'"
        ).bind(new Date().toISOString(), row.calling_id).run().catch(() => {}));
      }
    }
    return json(updated);
  }

  if (method === 'DELETE' && recordId) {
    // interview_pipeline.calling_id rows are auto-created/removed shadow rows the sync
    // jobs manage based on the calling's status (see syncSettingApartInterviews /
    // syncCallingInterviews in jobs.ts) — the user never creates or owns that link
    // directly, so deleting the calling should just take its shadow interviews with it
    // rather than blocking on the FK constraint.
    if (tableName === 'calling-pipeline') {
      await db.prepare('DELETE FROM interview_pipeline WHERE calling_id = ?').bind(recordId).run();
    }
    try {
      await db.prepare(
        `DELETE FROM ${tableConfig.name} WHERE id = ?`
      ).bind(recordId).run();
    } catch (e) {
      if (isForeignKeyConstraintError(e)) {
        return json({ error: 'This record is still linked to other data and can\'t be deleted.' }, 409);
      }
      throw e;
    }
    if (tableName === 'calling-pipeline') waitUntil(syncSettingApartInterviews(db).catch(() => {}));
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
