import type { CalendarEvent } from '../lib/api';
import Modal from './Modal';
import { Input, Select, Textarea, Checkbox } from './FormFields';
import { SHARE_WITH_OPTIONS } from '../lib/constants';
import LastEdited from './LastEdited';

// Extract YYYY-MM-DD for a date input — slicing avoids any timezone conversion
function toDateInput(dates: string): string {
  return dates ? dates.slice(0, 10) : '';
}

export default function CalendarEventModal({ editing, onClose, onChange, onSave, onDelete }: {
  editing: Partial<CalendarEvent> | null;
  onClose: () => void;
  onChange: (next: Partial<CalendarEvent>) => void;
  onSave: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <Modal open={!!editing} onClose={onClose} title={editing?.id ? 'Edit Event' : 'New Event'}>
      {editing && (
        <form onSubmit={e => { e.preventDefault(); onSave(); }} className="space-y-3">
          <Input label="Event Name" value={editing.name || ''} onChange={v => onChange({ name: v })} required />
          <Input label="Date" value={toDateInput(editing.dates || '')} onChange={v => onChange({ dates: v })} type="date" />
          <Textarea label="Notes" value={editing.notes || ''} onChange={v => onChange({ notes: v })} />
          <Select label="Share With" value={editing.share_with || ''} onChange={v => onChange({ share_with: v })} options={SHARE_WITH_OPTIONS} />
          <Checkbox label="Announce in sacrament meeting" checked={!!editing.announce_in_sacrament} onChange={v => onChange({ announce_in_sacrament: v ? 1 : 0 })} />
          <LastEdited updatedBy={editing.updated_by} updatedAt={editing.updated_at} />
          <div className="flex justify-between pt-2">
            <div>
              {editing.id && (
                <button type="button" onClick={() => { onDelete(editing.id!); onClose(); }} className="px-4 py-2 text-sm text-red-600 hover:text-red-800">Delete</button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
