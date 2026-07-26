import { useState } from 'react';
import { useTable } from '../../lib/useTable';
import type { BishopricMoveItem } from '../../lib/api';
import { useConfirm } from '../../components/ConfirmDialog';
import { priorMeetingDate } from '../../lib/priorWeek';

function ItemText({ item, onSave }: { item: BishopricMoveItem; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input autoFocus defaultValue={item.item}
        onBlur={e => { setEditing(false); if (e.target.value.trim() && e.target.value !== item.item) onSave(e.target.value); }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
        className="flex-1 text-sm rounded border border-gray-300 px-2 py-1" />
    );
  }
  return (
    <button type="button" onClick={() => setEditing(true)}
      className={`flex-1 text-left text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
      {item.item}
    </button>
  );
}

export default function MoveItemsSection({ kind, date, title, meetingDates, onAddToSacramentAgenda }: {
  kind: 'move_in' | 'move_out' | 'other';
  date: string;
  title: string;
  meetingDates: { date: string }[];
  onAddToSacramentAgenda?: (text: string) => void;
}) {
  const { rows: allItems, create, update, remove } = useTable<BishopricMoveItem>('bishopric-move-items');
  const confirm = useConfirm();
  const [newItem, setNewItem] = useState('');

  const items = allItems
    .filter(i => i.meeting_date === date && i.kind === kind)
    .sort((a, b) => a.position - b.position || a.id - b.id);

  const priorDate = priorMeetingDate(date, meetingDates);
  const priorItems = priorDate
    ? allItems.filter(i => i.meeting_date === priorDate && i.kind === kind).sort((a, b) => a.position - b.position || a.id - b.id)
    : [];

  const handleAdd = async () => {
    const text = newItem.trim();
    if (!text) return;
    const maxPos = items.length ? Math.max(...items.map(i => i.position)) : 0;
    await create({ meeting_date: date, kind, item: text, position: maxPos + 1 }, { silent: true });
    setNewItem('');
  };

  const toggleDone = (i: BishopricMoveItem) => update(i.id, { done: i.done ? 0 : 1 }, { silent: true });
  const saveText = (i: BishopricMoveItem, v: string) => update(i.id, { item: v }, { silent: true });
  const moveItem = (i: BishopricMoveItem, dir: 1 | -1) => {
    const idx = items.findIndex(x => x.id === i.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const other = items[swapIdx];
    update(i.id, { position: other.position }, { silent: true });
    update(other.id, { position: i.position }, { silent: true });
  };
  const deleteItem = async (i: BishopricMoveItem) => {
    if (await confirm({ message: 'Delete this item?' })) remove(i.id);
  };

  const handleCopyFromLastWeek = async () => {
    if (!priorItems.length) return;
    if (!await confirm({
      message: `Replace this week's "${title}" list with last week's ${priorItems.length} item(s)? This week's current list will be deleted.`,
    })) return;
    for (const i of items) await remove(i.id);
    for (const [idx, i] of priorItems.entries()) {
      await create({ meeting_date: date, kind, item: i.item, position: idx + 1 }, { silent: true });
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        {priorItems.length > 0 && (
          <button onClick={handleCopyFromLastWeek} className="text-xs text-gray-400 hover:text-gray-600">
            Copy from last week ({priorItems.length})
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <input value={newItem} onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={`Add ${title.toLowerCase()}...`}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
        <button onClick={handleAdd} disabled={!newItem.trim()}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Add
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3 bg-white rounded-lg border border-gray-200 border-dashed">
          No {title.toLowerCase()} yet
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-2">
              <input type="checkbox" checked={!!item.done} onChange={() => toggleDone(item)} className="rounded border-gray-300" />
              <ItemText item={item} onSave={v => saveText(item, v)} />
              <div className="flex items-center gap-1 shrink-0">
                {onAddToSacramentAgenda && (
                  <button onClick={() => onAddToSacramentAgenda(item.item)}
                    className="text-blue-500 hover:text-blue-700 text-xs px-1">Add to sacrament agenda</button>
                )}
                <button onClick={() => moveItem(item, -1)} disabled={idx === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1">▲</button>
                <button onClick={() => moveItem(item, 1)} disabled={idx === items.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1">▼</button>
                <button onClick={() => deleteItem(item)} className="text-red-400 hover:text-red-600 text-xs px-1">Del</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
