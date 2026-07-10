import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type User } from '../lib/api';
import { useAuth } from '../lib/auth';
import Modal from '../components/Modal';
import { Input } from '../components/FormFields';
import { toast } from '../lib/toast';
import { useConfirm } from '../components/ConfirmDialog';


const API = '/api/users';

function AddMemberModal({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string, tempPassword: string) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '' });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.create<User & { temp_password: string }>('users', { ...form, role: 'user', hub: 'wc' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wc-users'] });
      onCreated(data.name, data.temp_password);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Modal open onClose={onClose} title="Add Ward Council Member">
      <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="space-y-3">
        <Input label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
        <Input label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" required />
        <p className="text-xs text-gray-500">This account will have Ward Council Hub access. A temporary password will be generated.</p>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button type="submit" disabled={mutation.isPending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700 disabled:opacity-50">
            {mutation.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditMemberModal({ member, onClose }: { member: User; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: member.name, email: member.email });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/${member.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wc-users'] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Modal open onClose={onClose} title="Edit Member">
      <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="space-y-3">
        <Input label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
        <Input label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" required />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button type="submit" disabled={mutation.isPending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700 disabled:opacity-50">
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function WardCouncilMembers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState<{ name: string; password: string } | null>(null);
  const isAdmin = user?.role === 'admin';
  const confirmDialog = useConfirm();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['wc-users'],
    queryFn: () => api.users.list('wc'),
  });

  const resetMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await fetch(`${API}/${id}/reset-password`, { method: 'PUT' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const data = await res.json();
      return { name, temp_password: data.temp_password };
    },
    onSuccess: (data) => setTempPassword({ name: data.name, password: data.temp_password }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wc-users'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-gray-400 text-sm">Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Ward Council Members</h1>
        {isAdmin && (
          <button onClick={() => setAdding(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700">
            + Add Member
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">The people with Ward Council Hub access.</p>

      {adding && (
        <AddMemberModal
          onClose={() => setAdding(false)}
          onCreated={(name, password) => { setAdding(false); setTempPassword({ name, password }); }}
        />
      )}
      {editing && <EditMemberModal member={editing} onClose={() => setEditing(null)} />}

      {members.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No ward council members yet.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-emerald-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Calling</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                {isAdmin && <th className="px-4 py-3 font-medium text-gray-600">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                  <td className="px-4 py-3 text-gray-600">{m.church_role || <span className="text-gray-300 italic">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{m.email}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setEditing(m)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                        <button onClick={() => resetMutation.mutate({ id: m.id, name: m.name })}
                          className="text-yellow-600 hover:text-yellow-800 text-xs font-medium">Reset PW</button>
                        {m.id !== user?.id && (
                          <button onClick={async () => { if (await confirmDialog({ message: `Delete ${m.name}?` })) deleteMutation.mutate(m.id); }}
                            className="text-red-400 hover:text-red-600 text-xs">Del</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      <Modal open={!!tempPassword} onClose={() => setTempPassword(null)} title="Password Reset">
        {tempPassword && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              <strong>{tempPassword.name}</strong>'s password has been reset. Give them this temporary password:
            </p>
            <p className="font-mono text-lg bg-gray-100 rounded px-3 py-2 text-center">{tempPassword.password}</p>
            <p className="text-xs text-gray-500">They will be prompted to change it on next login.</p>
            <div className="flex justify-end pt-1">
              <button onClick={() => setTempPassword(null)} className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700">Done</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
