import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { User, RegistrationRequest } from '../lib/api';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import Modal from '../components/Modal';
import { Input, Select } from '../components/FormFields';
import { CHURCH_ROLES, BISHOPRIC_CALLINGS, WC_CALLINGS, YC_CALLINGS, CAL_CALLINGS, hubForChurchRole, HUB_LABELS } from '../lib/constants';
import { toast } from '../lib/toast';
import { useConfirm } from '../components/ConfirmDialog';

const API = '/api/users';
const DATALIST_ID = 'church-roles-list';

async function fetchUsers(): Promise<User[]> {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

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

const GROUP_ORDER = ['both', 'wc', 'yc', 'cal'] as const;
const GROUP_COLORS: Record<string, { header: string; stripe: string }> = {
  both: { header: 'bg-blue-50 text-blue-800', stripe: '' },
  wc: { header: 'bg-emerald-50 text-emerald-800', stripe: '' },
  yc: { header: 'bg-amber-50 text-amber-800', stripe: '' },
  cal: { header: 'bg-violet-50 text-violet-800', stripe: '' },
};
const GROUP_DESCRIPTIONS: Record<string, string> = {
  both: 'Full access to Bishopric Hub and Ward Council Hub',
  wc: '',
  yc: 'Youth Calendar only',
  cal: 'Calendar of Events only',
};

export default function Users() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const confirmDialog = useConfirm();

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'user', church_role: '', hub: '' });
  const [addError, setAddError] = useState('');

  const [changingPassword, setChangingPassword] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const [tempPassword, setTempPassword] = useState<{ name: string; password: string } | null>(null);

  // Registration requests (admin only)
  const { data: regRequests = [], refetch: refetchRegs } = useQuery<RegistrationRequest[]>({
    queryKey: ['registration-requests'],
    queryFn: () => api.registrationRequests.list(),
    enabled: isAdmin,
  });
  const [regEdits, setRegEdits] = useState<Record<number, Partial<RegistrationRequest>>>({});
  const [regHub, setRegHub] = useState<Record<number, string>>({});
  const [regLoading, setRegLoading] = useState<Record<number, string>>({});

  const getRegField = (req: RegistrationRequest, field: keyof RegistrationRequest) =>
    (regEdits[req.id]?.[field] ?? req[field]) as string;

  const handleRegChange = (id: number, field: keyof RegistrationRequest, value: string) =>
    setRegEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const handleApprove = async (req: RegistrationRequest) => {
    setRegLoading(prev => ({ ...prev, [req.id]: 'approve' }));
    try {
      const edits = regEdits[req.id];
      if (edits && Object.keys(edits).length > 0) {
        await api.registrationRequests.update(req.id, edits);
      }
      await api.registrationRequests.approve(req.id, regHub[req.id]);
      await Promise.all([refetchRegs(), queryClient.invalidateQueries({ queryKey: ['users'] })]);
      setRegEdits(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      setRegHub(prev => { const n = { ...prev }; delete n[req.id]; return n; });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Approval failed');
    }
    setRegLoading(prev => { const n = { ...prev }; delete n[req.id]; return n; });
  };

  const handleReject = async (req: RegistrationRequest) => {
    if (!await confirmDialog({ message: `Reject request from ${req.name}?` })) return;
    setRegLoading(prev => ({ ...prev, [req.id]: 'reject' }));
    try {
      await api.registrationRequests.reject(req.id);
      refetchRegs();
    } catch {
      toast.error('Failed to reject request');
    }
    setRegLoading(prev => { const n = { ...prev }; delete n[req.id]; return n; });
  };

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [editError, setEditError] = useState('');

  const [changingEmail, setChangingEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({ email: '' });
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  const grouped = useMemo(() => {
    const map: Record<string, User[]> = { both: [], wc: [], yc: [], cal: [] };
    for (const u of users) {
      const key = u.hub === 'both' || u.hub === 'bh' ? 'both' : u.hub === 'wc' ? 'wc' : u.hub === 'yc' ? 'yc' : u.hub === 'cal' ? 'cal' : 'both';
      map[key].push(u);
    }
    return map;
  }, [users]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      return res.json() as Promise<User & { temp_password: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setAdding(false);
      setForm({ name: '', email: '', role: 'user', church_role: '', hub: '' });
      setAddError('');
      setTempPassword({ name: data.name, password: data.temp_password });
    },
    onError: (e: Error) => setAddError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const res = await fetch(`${API}/${id}/role`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const hubMutation = useMutation({
    mutationFn: async ({ id, hub }: { id: number; hub: string }) => {
      const res = await fetch(`${API}/${id}/hub`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hub }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const churchRoleMutation = useMutation({
    mutationFn: async ({ id, church_role }: { id: number; church_role: string }) => {
      const res = await fetch(`${API}/${id}/church-role`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ church_role }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: Error) => toast.error(e.message),
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

  const isKnownCalling = !form.church_role || CHURCH_ROLES.includes(form.church_role);
  const derivedHub = hubForChurchRole(form.church_role);

  return (
    <div>
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

      {isAdmin && regRequests.length > 0 && (
        <div className="mb-6 bg-white rounded-lg border border-amber-300 overflow-x-auto">
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">{regRequests.length}</span>
            <h2 className="font-semibold text-sm text-amber-800">Pending Access Requests</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-3 py-2 font-medium text-gray-600">Name</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Email</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Calling</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Requested</th>
                <th className="px-3 py-2 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {regRequests.map(req => (
                <tr key={req.id} className="border-b border-gray-50 hover:bg-amber-50/40">
                  <td className="px-3 py-2 font-medium text-gray-900">
                    <input
                      value={getRegField(req, 'name')}
                      onChange={e => handleRegChange(req.id, 'name', e.target.value)}
                      className="rounded border border-transparent hover:border-gray-300 focus:border-blue-500 px-1 py-0.5 text-sm w-full min-w-[120px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    <input
                      type="email"
                      value={getRegField(req, 'email')}
                      onChange={e => handleRegChange(req.id, 'email', e.target.value)}
                      className="rounded border border-transparent hover:border-gray-300 focus:border-blue-500 px-1 py-0.5 text-sm w-full min-w-[160px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      list={DATALIST_ID}
                      value={getRegField(req, 'church_role')}
                      onChange={e => handleRegChange(req.id, 'church_role', e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1 text-sm w-full min-w-[160px]"
                    />
                    {getRegField(req, 'church_role') && !CHURCH_ROLES.includes(getRegField(req, 'church_role')) && (
                      <select value={regHub[req.id] || ''} onChange={e => setRegHub(prev => ({ ...prev, [req.id]: e.target.value }))}
                        className="mt-1 rounded border border-amber-300 px-2 py-1 text-xs w-full min-w-[160px]">
                        <option value="">New calling — choose a hub…</option>
                        <option value="both">Bishopric and WC Hubs</option>
                        <option value="wc">Ward Council Only</option>
                        <option value="yc">Youth Council</option>
                        <option value="cal">Calendar</option>
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(req.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' '}
                    {new Date(req.requested_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={!!regLoading[req.id]}
                        className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                        {regLoading[req.id] === 'approve' ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleReject(req)}
                        disabled={!!regLoading[req.id]}
                        className="px-3 py-1 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50">
                        {regLoading[req.id] === 'reject' ? 'Rejecting…' : 'Reject'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="space-y-6">
          {GROUP_ORDER.map(hub => {
            const group = grouped[hub];
            if (!group || group.length === 0) return null;
            const colors = GROUP_COLORS[hub];
            return (
              <div key={hub} className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
                <div className={`px-4 py-2 ${colors.header} border-b border-gray-200`}>
                  <h2 className="font-semibold text-sm">{HUB_LABELS[hub] || hub}</h2>
                  <p className="text-xs opacity-75">{GROUP_DESCRIPTIONS[hub]}</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Name</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Email</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Role</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Calling</th>
                      {isAdmin && <th className="text-left px-3 py-2 font-medium text-gray-600">Hub</th>}
                      {isAdmin && <th className="text-left px-3 py-2 font-medium text-gray-600">Last Access</th>}
                      {isAdmin && <th className="px-3 py-2 font-medium text-gray-600">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {group.map(u => (
                      <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{u.name}</td>
                        <td className="px-3 py-2 text-gray-700">{u.email}</td>
                        <td className="px-3 py-2">
                          {isAdmin ? (
                            BISHOPRIC_CALLINGS.includes(u.church_role ?? '') ? (
                              <select value={u.role} onChange={e => roleMutation.mutate({ id: u.id, role: e.target.value })}
                                className="rounded border border-gray-300 px-2 py-1 text-sm">
                                <option value="admin">admin</option>
                                <option value="user">user</option>
                              </select>
                            ) : (
                              <span className="text-gray-500 text-sm">user</span>
                            )
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
                            {u.church_role && CHURCH_ROLES.includes(u.church_role) ? (
                              <span className="text-sm text-gray-500 italic">{HUB_LABELS[hubForChurchRole(u.church_role)] ?? '—'}</span>
                            ) : (
                              <select value={u.hub === 'bh' ? 'both' : u.hub ?? 'both'} onChange={e => hubMutation.mutate({ id: u.id, hub: e.target.value })}
                                className="rounded border border-gray-300 px-2 py-1 text-sm">
                                <option value="both">Bishopric and WC Hubs</option>
                                <option value="wc">Ward Council Only</option>
                                <option value="yc">Youth Council</option>
                                <option value="cal">Calendar</option>
                              </select>
                            )}
                          </td>
                        )}
                        {isAdmin && (
                          <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                            {u.last_access
                              ? new Date(u.last_access).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : <span className="italic">Never</span>}
                          </td>
                        )}
                        {isAdmin && (
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              <button onClick={() => { setEditingUser(u); setEditForm({ name: u.name, email: u.email }); setEditError(''); }}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                              <button onClick={() => resetMutation.mutate({ id: u.id, name: u.name })}
                                className="text-yellow-600 hover:text-yellow-800 text-xs font-medium">Reset PW</button>
                              {u.id !== currentUser?.id && (
                                <button onClick={async () => { if (await confirmDialog({ message: `Delete ${u.name}?` })) deleteMutation.mutate(u.id); }}
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
            );
          })}
        </div>
      )}

      {isAdmin && (
        <details className="mt-6 group">
          <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 select-none">
            <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
            Hub Access Reference
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {([
              { label: 'Bishopric Hub', desc: 'Full bishopric + ward council access', color: 'border-blue-200 bg-blue-50', header: 'text-blue-800', callings: BISHOPRIC_CALLINGS },
              { label: 'Ward Council Hub', desc: 'Ward council access only', color: 'border-emerald-200 bg-emerald-50', header: 'text-emerald-800', callings: WC_CALLINGS },
              { label: 'Youth Council Hub', desc: 'Youth calendar only', color: 'border-amber-200 bg-amber-50', header: 'text-amber-800', callings: YC_CALLINGS },
              { label: 'Calendar Hub', desc: 'Calendar of events only', color: 'border-violet-200 bg-violet-50', header: 'text-violet-800', callings: CAL_CALLINGS },
            ] as const).map(({ label, desc, color, header, callings }) => (
              <div key={label} className={`rounded-lg border p-3 ${color}`}>
                <p className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${header}`}>{label}</p>
                <p className="text-xs text-gray-500 mb-2">{desc}</p>
                <ul className="space-y-0.5">
                  {(callings as readonly string[]).map(c => (
                    <li key={c} className="text-xs text-gray-700">{c}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
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
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Calling</span>
            <input
              list={DATALIST_ID}
              value={form.church_role}
              onChange={e => setForm(f => ({ ...f, church_role: e.target.value, hub: '' }))}
              placeholder="Select or type a new calling…"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Select label="Role" value={form.role} onChange={v => setForm({ ...form, role: v })} options={['user', 'admin']} />
            </div>
            <div className="flex-1">
              {isKnownCalling ? (
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Hub Access</span>
                  <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    {HUB_LABELS[derivedHub] || derivedHub}
                  </div>
                </label>
              ) : (
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Hub Access</span>
                  <select value={form.hub} onChange={e => setForm(f => ({ ...f, hub: e.target.value }))} required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                    <option value="">Choose a hub…</option>
                    <option value="both">Bishopric and WC Hubs</option>
                    <option value="wc">Ward Council Only</option>
                    <option value="yc">Youth Council</option>
                    <option value="cal">Calendar</option>
                  </select>
                </label>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400">
            {isKnownCalling
              ? 'Hub access is automatically set based on calling.'
              : "This is a new calling not on the standard list — please choose which hub this person should access."}
          </p>
          <p className="text-xs text-gray-400">A temporary password will be generated and shown after creating this user.</p>
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
