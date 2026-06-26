import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { User } from '../lib/api';
import { useAuth } from '../lib/auth';
import Modal from '../components/Modal';
import { Input, Select } from '../components/FormFields';
import { CHURCH_ROLES } from '../lib/constants';

const API = '/api/users';
const DATALIST_ID = 'church-roles-list';

async function fetchUsers(): Promise<User[]> {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

// Module-level component to avoid remount issues
function ChurchRoleCell({ userId, value, onSave }: { userId: number; value: string; onSave: (id: number, role: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <input
      list={DATALIST_ID}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onSave(userId, local); }}
      placeholder="Select or type…"
      className="rounded border border-gray-300 px-2 py-1 text-sm w-full min-w-[160px]"
    />
  );
}

export default function Users() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'editor', church_role: '' });
  const [addError, setAddError] = useState('');

  const [changingPassword, setChangingPassword] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const [tempPassword, setTempPassword] = useState<{ name: string; password: string } | null>(null);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [editError, setEditError] = useState('');

  const [changingEmail, setChangingEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({ email: '' });
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setAdding(false); setForm({ name: '', email: '', password: '', role: 'editor', church_role: '' }); setAddError(''); },
    onError: (e: Error) => setAddError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: Error) => alert(e.message),
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const res = await fetch(`${API}/${id}/role`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: Error) => alert(e.message),
  });

  const churchRoleMutation = useMutation({
    mutationFn: async ({ id, church_role }: { id: number; church_role: string }) => {
      const res = await fetch(`${API}/${id}/church-role`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ church_role }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: Error) => alert(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await fetch(`${API}/${id}/reset-password`, { method: 'PUT' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const data = await res.json();
      return { name, temp_password: data.temp_password };
    },
    onSuccess: (data) => setTempPassword({ name: data.name, password: data.temp_password }),
    onError: (e: Error) => alert(e.message),
  });

  const profileMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name?: string; email?: string } }) => {
      const res = await fetch(`${API}/${id}/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: Error) => { setEditError(e.message); setEmailError(e.message); },
  });

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError('');
    try {
      await profileMutation.mutateAsync({ id: editingUser.id, data: { name: editForm.name, email: editForm.email } });
      setEditingUser(null);
    } catch { /* error set by mutation */ }
  };

  const handleEmailSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setEmailError(''); setEmailSuccess('');
    try {
      await profileMutation.mutateAsync({ id: currentUser.id, data: { email: emailForm.email } });
      setEmailSuccess('Email updated successfully');
      setEmailForm({ email: '' });
    } catch { /* error set by mutation */ }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (pwForm.newPw.length < 6) { setPwError('Password must be at least 6 characters'); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError('Passwords do not match'); return; }
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.newPw }),
    });
    if (!res.ok) { const d = await res.json(); setPwError(d.error || 'Failed'); return; }
    setPwSuccess('Password changed successfully');
    setPwForm({ current: '', newPw: '', confirm: '' });
  };

  return (
    <div>
      {/* datalist rendered once, shared by all ChurchRoleCell inputs */}
      <datalist id={DATALIST_ID}>
        {CHURCH_ROLES.map(r => <option key={r} value={r} />)}
      </datalist>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <div className="flex gap-2">
          <button onClick={() => { setEmailForm({ email: currentUser?.email || '' }); setEmailSuccess(''); setEmailError(''); setChangingEmail(true); }}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50">
            Change Email
          </button>
          <button onClick={() => setChangingPassword(true)}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50">
            Change Password
          </button>
          {isAdmin && (
            <button onClick={() => setAdding(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
              + Add User
            </button>
          )}
        </div>
      </div>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-3 py-2 font-medium text-gray-600">Name</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Email</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">App Role</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Church Role</th>
                {isAdmin && <th className="px-3 py-2 font-medium text-gray-600">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{u.name}</td>
                  <td className="px-3 py-2 text-gray-700">{u.email}</td>
                  <td className="px-3 py-2">
                    {isAdmin ? (
                      <select value={u.role} onChange={e => roleMutation.mutate({ id: u.id, role: e.target.value })}
                        className="rounded border border-gray-300 px-2 py-1 text-sm">
                        <option value="admin">admin</option>
                        <option value="editor">editor</option>
                      </select>
                    ) : (
                      <span className="text-gray-600 capitalize">{u.role}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isAdmin ? (
                      <ChurchRoleCell
                        userId={u.id}
                        value={u.church_role || ''}
                        onSave={(id, church_role) => churchRoleMutation.mutate({ id, church_role })}
                      />
                    ) : (
                      <span className="text-gray-600">{u.church_role || '—'}</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingUser(u); setEditForm({ name: u.name, email: u.email }); setEditError(''); }}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                        <button onClick={() => resetMutation.mutate({ id: u.id, name: u.name })}
                          className="text-yellow-600 hover:text-yellow-800 text-xs font-medium">Reset PW</button>
                        {u.id !== currentUser?.id && (
                          <button onClick={() => { if (confirm(`Delete ${u.name}?`)) deleteMutation.mutate(u.id); }}
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

      {/* Admin: edit user name + email */}
      <Modal open={!!editingUser} onClose={() => { setEditingUser(null); setEditError(''); }} title={`Edit User — ${editingUser?.name}`}>
        {editingUser && (
          <form onSubmit={handleEditSave} className="space-y-3">
            <Input label="Name" value={editForm.name} onChange={v => setEditForm({ ...editForm, name: v })} required />
            <Input label="Email" value={editForm.email} onChange={v => setEditForm({ ...editForm, email: v })} type="email" required />
            {editError && <p className="text-red-600 text-sm">{editError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setEditingUser(null); setEditError(''); }} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
            </div>
          </form>
        )}
      </Modal>

      {/* All users: change own email */}
      <Modal open={changingEmail} onClose={() => { setChangingEmail(false); setEmailError(''); setEmailSuccess(''); }} title="Change Email">
        <form onSubmit={handleEmailSave} className="space-y-3">
          <Input label="New Email" value={emailForm.email} onChange={v => setEmailForm({ email: v })} type="email" required />
          {emailError && <p className="text-red-600 text-sm">{emailError}</p>}
          {emailSuccess && <p className="text-green-600 text-sm">{emailSuccess}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setChangingEmail(false); setEmailError(''); setEmailSuccess(''); }} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
            {!emailSuccess && <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>}
          </div>
        </form>
      </Modal>

      {/* Add user */}
      <Modal open={adding} onClose={() => { setAdding(false); setAddError(''); }} title="Add User">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-3">
          <Input label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
          <Input label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" required />
          <Input label="Password" value={form.password} onChange={v => setForm({ ...form, password: v })} type="password" required />
          <Select label="App Role" value={form.role} onChange={v => setForm({ ...form, role: v })} options={['admin', 'editor']} />
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Church Role</span>
            <input
              list={DATALIST_ID}
              value={form.church_role}
              onChange={e => setForm({ ...form, church_role: e.target.value })}
              placeholder="Select or type…"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          {addError && <p className="text-red-600 text-sm">{addError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setAdding(false); setAddError(''); }} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Create</button>
          </div>
        </form>
      </Modal>

      {/* Change password */}
      <Modal open={changingPassword} onClose={() => { setChangingPassword(false); setPwError(''); setPwSuccess(''); }} title="Change Password">
        <form onSubmit={handleChangePassword} className="space-y-3">
          <Input label="Current Password" value={pwForm.current} onChange={v => setPwForm({ ...pwForm, current: v })} type="password" required />
          <Input label="New Password" value={pwForm.newPw} onChange={v => setPwForm({ ...pwForm, newPw: v })} type="password" required />
          <Input label="Confirm New Password" value={pwForm.confirm} onChange={v => setPwForm({ ...pwForm, confirm: v })} type="password" required />
          {pwError && <p className="text-red-600 text-sm">{pwError}</p>}
          {pwSuccess && <p className="text-green-600 text-sm">{pwSuccess}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setChangingPassword(false); setPwError(''); setPwSuccess(''); }} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Change</button>
          </div>
        </form>
      </Modal>

      {/* Temp password display */}
      <Modal open={!!tempPassword} onClose={() => setTempPassword(null)} title="Password Reset">
        {tempPassword && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              <strong>{tempPassword.name}</strong>'s password has been reset. Give them this temporary password:
            </p>
            <div className="bg-gray-100 rounded-md p-3 text-center">
              <code className="text-lg font-mono font-bold text-gray-900">{tempPassword.password}</code>
            </div>
            <p className="text-sm text-gray-500">They will be prompted to set a new password on their next login.</p>
            <div className="flex justify-end pt-2">
              <button onClick={() => setTempPassword(null)} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Done</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
