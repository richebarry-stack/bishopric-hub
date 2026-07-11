import Modal from '../Modal';
import StatusBadge from '../StatusBadge';
import { Input, Select, Textarea } from '../FormFields';
import type { InterviewPipeline as InterviewType, WardMember, CallingPipeline } from '../../lib/api';
import { INTERVIEW_STATUSES, SETUP_STATUSES, SETTING_APART_STATUSES } from '../../lib/constants';
import { YOUTH_TYPES, NO_REC_TYPES, YOUTH_STATE_COLORS, computeYouthAge, computeYouthState } from './shared';
import { legalName } from '../../lib/displayName';

function AssignedToField({ label, value, onChange, options, datalistId, help }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; datalistId: string; help?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        list={datalistId}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Select or type name…"
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      <datalist id={datalistId}>
        {options.map(o => <option key={o} value={o} />)}
      </datalist>
      {help && <p className="text-xs text-gray-400 mt-1">{help}</p>}
    </label>
  );
}

export default function InterviewEditModal({
  editing, onClose, onChange, onSave, wardMembers, wardMembersById, ageByName, activeYouthWardMemberIds,
  bishopricOptions, setupOptions, allowedTypes, preferredNameDraft, setPreferredNameDraft, callingsById,
}: {
  editing: Partial<InterviewType> | null;
  onClose: () => void;
  onChange: (next: Partial<InterviewType>) => void;
  onSave: () => void;
  wardMembers: WardMember[];
  wardMembersById: Map<number, WardMember>;
  ageByName: Map<string, number>;
  activeYouthWardMemberIds: Set<number>;
  bishopricOptions: string[];
  setupOptions: string[];
  allowedTypes: string[];
  preferredNameDraft: string;
  setPreferredNameDraft: (v: string) => void;
  callingsById: Map<number, CallingPipeline>;
}) {
  if (!editing) return null;

  const isSettingApart = editing.type_of_interview === 'Setting Apart';
  const linkedCalling = editing.calling_id ? callingsById.get(editing.calling_id) : undefined;

  const editingLinkedMember = editing.ward_member_id ? wardMembersById.get(editing.ward_member_id) : undefined;
  const editingAge = editingLinkedMember?.birth_date
    ? computeYouthAge(editingLinkedMember.birth_date)
    : (editing.member ? ageByName.get(editing.member.trim().toLowerCase()) ?? null : null);
  const editingIsManagedYouth = !!editing.ward_member_id && YOUTH_TYPES.has(editing.type_of_interview || '')
    && editingAge !== null && activeYouthWardMemberIds.has(editing.ward_member_id);
  const editingYouthState = editingIsManagedYouth ? computeYouthState(editing) : null;
  const showLinkPicker = !editing.ward_member_id && YOUTH_TYPES.has(editing.type_of_interview || '');
  const hideRecExpires = NO_REC_TYPES.has(editing.type_of_interview || '');

  return (
    <Modal open={!!editing} onClose={onClose} title={editing.id ? 'Edit Interview' : 'New Interview'}>
      <form onSubmit={e => { e.preventDefault(); onSave(); }} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
          <input
            value={editing.member || ''}
            onChange={e => onChange({ member: e.target.value })}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {editingLinkedMember && (
            <p className="text-xs text-gray-400 mt-1">Linked to Ward Members — saving here updates their name on the ward roster.</p>
          )}
        </div>

        {editingLinkedMember && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Name</label>
            <input
              value={preferredNameDraft}
              onChange={e => setPreferredNameDraft(e.target.value)}
              placeholder="e.g. Bud"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Shown instead of the name above wherever this person appears. Leave blank to use the legal name.</p>
          </div>
        )}

        {showLinkPicker && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link to Ward Member (optional)</label>
            <input
              list="ward-member-link-options"
              placeholder="Start typing a name…"
              onChange={e => {
                const match = wardMembers.find(wm => legalName(wm) === e.target.value);
                if (match) onChange({ ward_member_id: match.id, member: legalName(match) });
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <datalist id="ward-member-link-options">
              {wardMembers.map(wm => <option key={wm.id} value={legalName(wm)} />)}
            </datalist>
          </div>
        )}

        {editingIsManagedYouth ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type of Interview</label>
            <p className="text-sm text-gray-600">{editing.type_of_interview} <span className="text-xs text-gray-400">(auto-managed by age)</span></p>
            <p className="text-xs text-gray-400 mt-1">
              {editing.type_of_interview === 'Youth 16-17'
                ? 'Both interviews this year should be with the bishop himself, if possible.'
                : 'Alternate every 6 months: bishop, then the counselor over this youth\'s quorum/class.'}
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type of Interview</label>
            <input
              list="interview-type-options"
              value={editing.type_of_interview || ''}
              onChange={e => onChange({ type_of_interview: e.target.value })}
              placeholder="Select or type a type…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <datalist id="interview-type-options">
              {allowedTypes.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
        )}

        {linkedCalling && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Calling</label>
            <p className="text-sm text-gray-600">{linkedCalling.calling}</p>
          </div>
        )}

        {editingIsManagedYouth ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div className="mt-1"><StatusBadge status={editingYouthState!} colors={YOUTH_STATE_COLORS} /></div>
            <p className="text-xs text-gray-400 mt-1">Computed automatically from Next/Last Interview Date below.</p>
          </div>
        ) : (
          <Select label="Status" value={editing.status || ''} onChange={v => onChange({ status: v })} options={isSettingApart ? SETTING_APART_STATUSES : INTERVIEW_STATUSES} />
        )}
        {isSettingApart && editing.status === 'Complete' && (
          <p className="text-xs text-gray-400 -mt-2">Marking this Complete will set the linked calling's status to "Set apart".</p>
        )}

        <AssignedToField
          label="Interviewer"
          value={editing.assigned_to || ''}
          onChange={v => onChange({ assigned_to: v })}
          options={bishopricOptions}
          datalistId="interview-assigned-to-options"
          help="Who conducts the next interview."
        />

        <div className="grid grid-cols-2 gap-3 items-start">
          <AssignedToField
            label="Setup assigned to"
            value={editing.setup_assigned_to || ''}
            onChange={v => onChange({ setup_assigned_to: v })}
            options={setupOptions}
            datalistId="interview-setup-assigned-to-options"
            help="Who schedules the interview."
          />
          <Select label="Setup status" value={editing.setup_status || 'Not started'} onChange={v => onChange({ setup_status: v })} options={SETUP_STATUSES} />
        </div>

        {!hideRecExpires && (
          <Input label="Recommend Expires" value={(editing.date_recommend_expires || '').slice(0, 7)} onChange={v => onChange({ date_recommend_expires: v })} type="month" />
        )}
        {!isSettingApart && (
          <Input label="Last Interview Date" value={(editing.last_interview_datetime || '').slice(0, 10)} onChange={v => onChange({ last_interview_datetime: v })} type="date" />
        )}
        <Input label={isSettingApart ? 'Scheduled Date' : 'Next Interview Date'} value={(editing.next_interview_date || '').slice(0, 10)} onChange={v => onChange({ next_interview_date: v })} type="date" />
        <Input label="Comments" value={editing.comments || ''} onChange={v => onChange({ comments: v })} />
        <Textarea label="Notes" value={editing.notes || ''} onChange={v => onChange({ notes: v })} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
        </div>
      </form>
    </Modal>
  );
}
