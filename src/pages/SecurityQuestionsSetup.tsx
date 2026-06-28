import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { SECURITY_QUESTIONS } from '../lib/constants';

export default function SecurityQuestionsSetup({ onSkip }: { onSkip: () => void }) {
  const { markSecurityQuestionsSetup } = useAuth();
  const [q1, setQ1] = useState(SECURITY_QUESTIONS[0]);
  const [a1, setA1] = useState('');
  const [q2, setQ2] = useState(SECURITY_QUESTIONS[1]);
  const [a2, setA2] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q1 === q2) { setError('Please choose two different questions.'); return; }
    if (a1.trim().length < 2 || a2.trim().length < 2) { setError('Each answer must be at least 2 characters.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.auth.saveSecurityQuestions({ question1: q1, answer1: a1, question2: q2, answer2: a2 });
      markSecurityQuestionsSetup();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const availableForQ2 = SECURITY_QUESTIONS.filter(q => q !== q1);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold text-gray-900">Set Up Security Questions</h1>
          <p className="text-sm text-gray-500 mt-2">These allow you to reset your password if you ever forget it.</p>
        </div>
        <form onSubmit={handleSave} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Question 1</label>
            <select value={q1} onChange={e => { setQ1(e.target.value); if (e.target.value === q2) setQ2(availableForQ2.find(q => q !== e.target.value) ?? SECURITY_QUESTIONS[1]); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            <input type="text" placeholder="Your answer" value={a1} onChange={e => setA1(e.target.value)} required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Question 2</label>
            <select value={q2} onChange={e => setQ2(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              {SECURITY_QUESTIONS.filter(q => q !== q1).map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            <input type="text" placeholder="Your answer" value={a2} onChange={e => setA2(e.target.value)} required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <p className="text-xs text-gray-400">Answers are not case-sensitive.</p>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onSkip}
              className="flex-1 py-2 px-4 rounded-md text-sm text-gray-600 border border-gray-300 hover:bg-gray-50">
              Skip for now
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Questions'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
