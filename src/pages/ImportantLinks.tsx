import { useState } from 'react';
import { useTable } from '../lib/useTable';
import type { ImportantLink } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Textarea } from '../components/FormFields';
import { useConfirm } from '../components/ConfirmDialog';

const EMPTY: Partial<ImportantLink> = { title: '', url: '', description: '' };

function normalizeUrl(url: string): string {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default function ImportantLinks() {
  const { rows, isLoading, create, update, remove } = useTable<ImportantLink>('important-links');
  const [editing, setEditing] = useState<Partial<ImportantLink> | null>(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const handleSave = async () => {
    if (!editing || saving) return;
    setSaving(true);
    try {
      const data = { ...editing, url: normalizeUrl(editing.url || '') };
      const id = (data as ImportantLink).id;
      delete (data as Record<string, unknown>).id;
      if (id) await update(id, data as Record<string, unknown>);
      else await create(data as Record<string, unknown>);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Important Links</h1>
        <button onClick={() => setEditing({ ...EMPTY })}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          + Add Link
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">Frequently used URLs — handbooks, tools, and forms the bishopric references often.</p>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-400 text-sm italic">No links yet. Add one to get started.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(link => (
            <div key={link.id} className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-2 hover:border-blue-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <a
                  href={normalizeUrl(link.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm leading-snug break-all"
                >
                  {link.title}
                </a>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditing({ ...link })}
                    className="text-gray-400 hover:text-gray-600 text-xs">Edit</button>
                  <button onClick={async () => { if (await confirm({ message: `Delete "${link.title}"?` })) remove(link.id); }}
                    className="text-gray-400 hover:text-red-500 text-xs">Del</button>
                </div>
              </div>
              {link.description && (
                <p className="text-xs text-gray-500 leading-relaxed">{link.description}</p>
              )}
              <p className="text-xs text-gray-300 truncate">{normalizeUrl(link.url)}</p>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Link' : 'Add Link'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Input label="Title" value={editing.title || ''} onChange={v => setEditing({ ...editing, title: v })} required />
            <Input label="URL" value={editing.url || ''} onChange={v => setEditing({ ...editing, url: v })} placeholder="https://…" required />
            <Textarea label="Description" value={editing.description || ''} onChange={v => setEditing({ ...editing, description: v })} rows={2} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
