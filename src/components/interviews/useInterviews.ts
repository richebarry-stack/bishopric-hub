import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTable } from '../../lib/useTable';
import type { InterviewPipeline as InterviewType, WardMember, User, CallingPipeline } from '../../lib/api';
import { displayName, legalName } from '../../lib/displayName';
import { toast } from '../../lib/toast';
import { YOUTH_TYPES, computeYouthAge, computeYouthState, type RowMeta } from './shared';

export const EMPTY_INTERVIEW: Partial<InterviewType> = {
  member: '', date_recommend_expires: '', type_of_interview: '', status: 'Unassigned',
  assigned_to: '', setup_assigned_to: '', setup_status: 'Not started',
  last_interview_datetime: '', next_interview_date: '', comments: '', notes: '',
};

export function useInterviews() {
  const { rows, isLoading, create, update, remove } = useTable<InterviewType>('interview-pipeline');
  const { rows: wardMembers, isLoading: wardMembersLoading, update: updateWardMember } = useTable<WardMember>('ward-members');
  const { rows: callings } = useTable<CallingPipeline>('calling-pipeline');
  const { data: allUsers = [] } = useQuery<User[]>({ queryKey: ['users'], queryFn: () => fetch('/api/users').then(r => r.json()) });

  const [editing, setEditing] = useState<Partial<InterviewType> | null>(null);
  const [preferredNameDraft, setPreferredNameDraft] = useState('');
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkAssignedTo, setBulkAssignedTo] = useState('');
  const [bulkSetupStatus, setBulkSetupStatus] = useState('');
  const [bulkSetupAssignedTo, setBulkSetupAssignedTo] = useState('');
  const [showAgedOutYouth, setShowAgedOutYouth] = useState(false);

  const bishopricOptions = useMemo(() =>
    allUsers.filter(u => u.church_role && /bishop|counselor/i.test(u.church_role)).map(u => u.name),
    [allUsers]);

  // Setting up an interview (scheduling) is typically handled by the executive
  // secretary or an assistant, in addition to the bishop/counselors.
  const setupOptions = useMemo(() =>
    allUsers.filter(u => u.church_role && /bishop|counselor|executive secretary/i.test(u.church_role)).map(u => u.name),
    [allUsers]);

  const assignedOptions = useMemo(() => {
    const names = [...new Set(rows.map(r => r.assigned_to).filter(Boolean))].sort();
    return names;
  }, [rows]);

  const wardMembersById = useMemo(() => {
    const m = new Map<number, WardMember>();
    for (const wm of wardMembers) m.set(wm.id, wm);
    return m;
  }, [wardMembers]);

  const callingsById = useMemo(() => {
    const m = new Map<number, CallingPipeline>();
    for (const c of callings) m.set(c.id, c);
    return m;
  }, [callings]);

  const ageByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const wm of wardMembers) {
      if (wm.birth_date) {
        const age = computeYouthAge(wm.birth_date);
        if (age !== null) m.set(legalName(wm).trim().toLowerCase(), age);
      }
    }
    return m;
  }, [wardMembers]);

  const activeYouthWardMemberIds = useMemo(() => {
    const s = new Set<number>();
    for (const wm of wardMembers) {
      if (wm.active && wm.birth_date && computeYouthAge(wm.birth_date) !== null) s.add(wm.id);
    }
    return s;
  }, [wardMembers]);

  const rowMetaById = useMemo(() => {
    const m = new Map<number, RowMeta>();
    for (const r of rows) {
      let age: number | undefined;
      let name = r.member;
      const linked = r.ward_member_id ? wardMembersById.get(r.ward_member_id) : undefined;
      if (linked) {
        name = displayName(linked);
        if (linked.active && linked.birth_date) {
          const a = computeYouthAge(linked.birth_date);
          if (a !== null) age = a;
        }
      } else if (YOUTH_TYPES.has(r.type_of_interview)) {
        age = ageByName.get(r.member?.trim().toLowerCase() ?? '');
      }
      const youthState = age !== undefined && YOUTH_TYPES.has(r.type_of_interview) ? computeYouthState(r) : undefined;
      const calling = r.calling_id ? callingsById.get(r.calling_id)?.calling : undefined;
      m.set(r.id, { age, displayName: name, youthState, calling });
    }
    return m;
  }, [rows, wardMembersById, ageByName, callingsById]);

  const filtered = rows.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (assignedFilter && r.assigned_to !== assignedFilter) return false;
    if (typeFilter && r.type_of_interview !== typeFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      const name = rowMetaById.get(r.id)?.displayName ?? r.member;
      return name?.toLowerCase().includes(q) || r.member?.toLowerCase().includes(q) || r.type_of_interview?.toLowerCase().includes(q);
    }
    return true;
  });

  const isManagedYouth = (r: InterviewType) => rowMetaById.get(r.id)?.youthState !== undefined;

  const handleBulkStatus = async () => {
    if (!bulkStatus || selected.size === 0) return;
    const ids = [...selected];
    const settable = ids.filter(id => !isManagedYouth(rows.find(r => r.id === id)!));
    const skipped = ids.length - settable.length;
    await Promise.all(settable.map(id => update(id, { status: bulkStatus }, { silent: true })));
    toast.success(`Updated ${settable.length} interview${settable.length === 1 ? '' : 's'}${skipped > 0 ? ` (${skipped} skipped — youth status is computed)` : ''}`);
    setSelected(new Set());
    setBulkStatus('');
  };

  const handleBulkAssign = async () => {
    const name = bulkAssignedTo.trim();
    if (!name || selected.size === 0) return;
    await Promise.all([...selected].map(id => update(id, { assigned_to: name }, { silent: true })));
    toast.success(`Assigned ${selected.size} interview${selected.size === 1 ? '' : 's'} to ${name}`);
    setSelected(new Set());
    setBulkAssignedTo('');
  };

  const handleBulkSetupStatus = async () => {
    if (!bulkSetupStatus || selected.size === 0) return;
    await Promise.all([...selected].map(id => update(id, { setup_status: bulkSetupStatus }, { silent: true })));
    toast.success(`Updated setup status for ${selected.size} interview${selected.size === 1 ? '' : 's'}`);
    setSelected(new Set());
    setBulkSetupStatus('');
  };

  const handleBulkSetupAssign = async () => {
    const name = bulkSetupAssignedTo.trim();
    if (!name || selected.size === 0) return;
    await Promise.all([...selected].map(id => update(id, { setup_assigned_to: name }, { silent: true })));
    toast.success(`Assigned setup for ${selected.size} interview${selected.size === 1 ? '' : 's'} to ${name}`);
    setSelected(new Set());
    setBulkSetupAssignedTo('');
  };

  const toggleSelect = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleSave = async () => {
    if (!editing) return;
    const data = { ...editing } as Record<string, unknown>;
    delete data.id;
    const wardMemberId = data.ward_member_id as number | undefined | null;
    const newName = ((data.member as string) || '').trim();
    if (wardMemberId) {
      const linked = wardMembersById.get(wardMemberId);
      if (linked) {
        const wardMemberUpdate: Record<string, unknown> = {};
        const [newLast, newFirst] = newName.includes(',')
          ? newName.split(',').map(p => p.trim())
          : [newName, ''];
        if (newName && (newLast !== linked.last_name || newFirst !== linked.first_name)) {
          wardMemberUpdate.last_name = newLast;
          wardMemberUpdate.first_name = newFirst;
        }
        const newPreferredFirst = preferredNameDraft.trim();
        if (newPreferredFirst !== (linked.preferred_first_name || '')) wardMemberUpdate.preferred_first_name = newPreferredFirst;
        if (YOUTH_TYPES.has((data.type_of_interview as string) || '')) {
          const newExpires = ((data.date_recommend_expires as string) || '').slice(0, 10);
          const linkedExpires = (linked.recommend_expires || '').slice(0, 10);
          if (newExpires !== linkedExpires) {
            wardMemberUpdate.recommend_expires = newExpires;
            if (newExpires) wardMemberUpdate.recommend_type = linked.recommend_type === 'Endowed' ? 'Endowed' : 'Limited';
          }
        }
        if (Object.keys(wardMemberUpdate).length > 0) await updateWardMember(wardMemberId, wardMemberUpdate);
      }
    }
    if (editing.id) await update(editing.id, data);
    else await create(data);
    setEditing(null);
  };

  const agedOutYouthCount = useMemo(() =>
    wardMembersLoading ? 0 : rows.filter(r => YOUTH_TYPES.has(r.type_of_interview) && r.ward_member_id && !activeYouthWardMemberIds.has(r.ward_member_id)).length,
    [rows, activeYouthWardMemberIds, wardMembersLoading]);

  useEffect(() => {
    const editingLinkedMember = editing?.ward_member_id ? wardMembersById.get(editing.ward_member_id) : undefined;
    setPreferredNameDraft(editingLinkedMember?.preferred_first_name || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id, editing?.ward_member_id]);

  return {
    rows, isLoading, filtered, remove,
    wardMembers, wardMembersById, wardMembersLoading, ageByName, activeYouthWardMemberIds, callingsById,
    bishopricOptions, setupOptions, assignedOptions,
    rowMetaById, agedOutYouthCount,
    editing, setEditing,
    preferredNameDraft, setPreferredNameDraft,
    filter, setFilter, statusFilter, setStatusFilter, assignedFilter, setAssignedFilter, typeFilter, setTypeFilter,
    selected, setSelected, toggleSelect,
    bulkStatus, setBulkStatus, bulkAssignedTo, setBulkAssignedTo,
    bulkSetupStatus, setBulkSetupStatus, bulkSetupAssignedTo, setBulkSetupAssignedTo,
    handleBulkStatus, handleBulkAssign, handleBulkSetupStatus, handleBulkSetupAssign,
    handleSave,
    showAgedOutYouth, setShowAgedOutYouth,
  };
}
