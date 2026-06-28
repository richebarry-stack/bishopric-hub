import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { CHURCH_ROLES } from '../lib/constants';

type ForgotStep = 'email' | 'answers' | 'done';
type Mode = 'login' | 'register';

export default function Login() {
  const { login, chooseHub } = useAuth();
  const [mode, setMode] = useState<Mode>('login');

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsHubChoice, setNeedsHubChoice] = useState(false);

  // Forgot password state
  const [forgotStep, setForgotStep] = useState<ForgotStep | null>(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [questions, setQuestions] = useState<{ question1: string; question2: string } | null>(null);
  const [answer1, setAnswer1] = useState('');
  const [answer2, setAnswer2] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Register request state
  const [regForm, setRegForm] = useState({ name: '', email: '', church_role: '', password: '', confirm: '' });
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regDone, setRegDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.needsHubChoice) setNeedsHubChoice(true);
    } catch {
      setError('Invalid email or password');
    }
    setLoading(false);
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (!regForm.name.trim()) { setRegError('Name is required'); return; }
    if (!regForm.church_role) { setRegError('Please select your calling'); return; }
    if (regForm.password.length < 6) { setRegError('Password must be at least 6 characters'); return; }
    if (regForm.password !== regForm.confirm) { setRegError('Passwords do not match'); return; }
    setRegLoading(true);
    try {
      await api.registrationRequests.submit({
        name: regForm.name.trim(),
        email: regForm.email.trim(),
        church_role: regForm.church_role,
        password: regForm.password,
      });
      setRegDone(true);
    } catch (err: unknown) {
      setRegError(err instanceof Error ? err.message : 'Submission failed');
    }
    setRegLoading(false);
  };

  const handleForgotEmail = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      const data = await api.auth.getSecurityQuestions(forgotEmail);
      setQuestions(data);
      setForgotStep('answers');
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : 'Failed');
    }
    setForgotLoading(false);
  };

  const handleForgotReset = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (newPassword.length < 6) { setForgotError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setForgotError('Passwords do not match.'); return; }
    setForgotLoading(true);
    try {
      await api.auth.resetByQuestions({ email: forgotEmail, answer1, answer2, new_password: newPassword });
      setForgotStep('done');
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : 'Failed');
    }
    setForgotLoading(false);
  };

  const resetForgot = () => {
    setForgotStep(null);
    setForgotEmail('');
    setQuestions(null);
    setAnswer1('');
    setAnswer2('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
  };

  if (needsHubChoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-sm text-gray-500 mt-1">Which hub would you like to open?</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => chooseHub('bh')}
              className="flex flex-col items-center gap-2 p-6 bg-white border-2 border-blue-500 rounded-xl shadow-sm hover:bg-blue-50 transition-colors">
              <span className="text-3xl">⛪</span>
              <span className="font-semibold text-gray-900">Bishopric Hub</span>
              <span className="text-xs text-gray-500">Full bishopric tools</span>
            </button>
            <button onClick={() => chooseHub('wc')}
              className="flex flex-col items-center gap-2 p-6 bg-white border-2 border-emerald-500 rounded-xl shadow-sm hover:bg-emerald-50 transition-colors">
              <span className="text-3xl">🤝</span>
              <span className="font-semibold text-gray-900">Ward Council Hub</span>
              <span className="text-xs text-gray-500">Ward council view</span>
            </button>
          </div>
          <p className="text-xs text-gray-400">You can switch hubs at any time from the sidebar.</p>
        </div>
      </div>
    );
  }

  if (forgotStep === 'email') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
            <p className="text-sm text-gray-500 mt-1">Enter your email to find your account.</p>
          </div>
          <form onSubmit={handleForgotEmail} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            {forgotError && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{forgotError}</p>}
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Email</span>
              <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required autoFocus
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </label>
            <button type="submit" disabled={forgotLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {forgotLoading ? 'Looking up…' : 'Continue'}
            </button>
            <button type="button" onClick={resetForgot} className="w-full text-sm text-gray-500 hover:text-gray-700">
              Back to sign in
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (forgotStep === 'answers' && questions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
            <p className="text-sm text-gray-500 mt-1">Answer your security questions to continue.</p>
          </div>
          <form onSubmit={handleForgotReset} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            {forgotError && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{forgotError}</p>}
            <label className="block">
              <span className="text-sm font-medium text-gray-700">{questions.question1}</span>
              <input type="text" value={answer1} onChange={e => setAnswer1(e.target.value)} required autoFocus
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">{questions.question2}</span>
              <input type="text" value={answer2} onChange={e => setAnswer2(e.target.value)} required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </label>
            <hr className="border-gray-200" />
            <label className="block">
              <span className="text-sm font-medium text-gray-700">New Password</span>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Confirm Password</span>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </label>
            <button type="submit" disabled={forgotLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {forgotLoading ? 'Resetting…' : 'Reset Password'}
            </button>
            <button type="button" onClick={resetForgot} className="w-full text-sm text-gray-500 hover:text-gray-700">
              Back to sign in
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (forgotStep === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h1 className="text-xl font-bold text-gray-900">Password Reset</h1>
          <p className="text-sm text-gray-600">Your password has been updated. You can now sign in.</p>
          <button onClick={resetForgot} className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700">
            Sign in
          </button>
        </div>
      </div>
    );
  }

  // Register request — success screen
  if (mode === 'register' && regDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h1 className="text-xl font-bold text-gray-900">Request Submitted</h1>
          <p className="text-sm text-gray-600">
            Your access request has been submitted. An administrator will review it and activate your account.
          </p>
          <button onClick={() => { setMode('login'); setRegDone(false); setRegForm({ name: '', email: '', church_role: '', password: '', confirm: '' }); }}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700">
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  // Register request form
  if (mode === 'register') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Request Access</h1>
            <p className="text-sm text-gray-500 mt-1">An admin will review and activate your account.</p>
          </div>
          <form onSubmit={handleRegisterSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            {regError && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{regError}</p>}
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Full Name</span>
              <input type="text" value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))} required autoFocus
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Email</span>
              <input type="email" value={regForm.email} onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))} required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Calling</span>
              <select value={regForm.church_role} onChange={e => setRegForm(f => ({ ...f, church_role: e.target.value }))} required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                <option value="">Select your calling…</option>
                {CHURCH_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Password</span>
              <input type="password" value={regForm.password} onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))} required minLength={6}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Confirm Password</span>
              <input type="password" value={regForm.confirm} onChange={e => setRegForm(f => ({ ...f, confirm: e.target.value }))} required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </label>
            <button type="submit" disabled={regLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {regLoading ? 'Submitting…' : 'Submit Request'}
            </button>
          </form>
          <p className="text-center mt-4">
            <button onClick={() => { setMode('login'); setRegError(''); }}
              className="text-sm text-blue-600 hover:text-blue-800">
              Back to sign in
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Bishopric Hub</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Password</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </label>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div className="flex justify-between mt-4 px-1">
          <button onClick={() => { setForgotEmail(email); setForgotStep('email'); }}
            className="text-sm text-blue-600 hover:text-blue-800">
            Forgot password?
          </button>
          <button onClick={() => { setMode('register'); setRegError(''); }}
            className="text-sm text-blue-600 hover:text-blue-800">
            Request access
          </button>
        </div>
      </div>
    </div>
  );
}
