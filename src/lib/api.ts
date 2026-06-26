const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (res.status === 401 && !path.startsWith('/auth/')) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request<{ user: User | null }>('/auth/me'),
    register: (data: { name: string; email: string; password: string; role: string }) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  },
  syncConduct: () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return request('/sync-conduct', { method: 'POST', body: JSON.stringify({ today }) });
  },
  list: <T>(table: string) => request<T[]>(`/${table}`),
  get: <T>(table: string, id: number) => request<T>(`/${table}/${id}`),
  create: <T>(table: string, data: Record<string, unknown>) =>
    request<T>(`/${table}`, { method: 'POST', body: JSON.stringify(data) }),
  update: <T>(table: string, id: number, data: Record<string, unknown>) =>
    request<T>(`/${table}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (table: string, id: number) =>
    request(`/${table}/${id}`, { method: 'DELETE' }),
};

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  church_role: string;
  must_reset_password?: boolean;
}

export interface CallingPipeline {
  id: number;
  member: string;
  calling: string;
  status: string;
  assigned_to: string;
  sustain_recorded: number;
  set_apart_recorded: number;
  organization: string;
  type: string; // 'Calling' | 'Release'
}

export interface InterviewPipeline {
  id: number;
  member: string;
  date_recommend_expires: string;
  type_of_interview: string;
  status: string;
  assigned_to: string;
  last_interview_datetime: string;
  next_interview_date: string;
  comments: string;
  notes: string;
}

export interface Task {
  id: number;
  task: string;
  assigned_to: string;
  created_date: string;
  done: number;
  share_with: string;
}

export interface RotatingAssignment {
  id: number;
  month: string;
  plan_conduct: string;
  primary_message: string;
}

export interface BishopricMeeting {
  id: number;
  date: string;
  spiritual_thought: string;
  opening_prayer: string;
  closing_prayer: string;
  handbook_training: string;
  handbook_section: string;
  minutes: string;
  no_meeting: number;
  reason_not_meeting: string;
}

export interface OutOfTown {
  id: number;
  who: string;
  start_date: string;
  end_date: string;
  notes: string;
}

export interface SacramentSpeaker {
  id: number;
  meeting_date: string;
  speaker: string;
  speaker_type: string;
  accepted: string;
  speaking_order: number;
  topic: string;
  notes: string;
  missionary_id: number | null;
  speaker_occasion: string | null;
  position: number | null;
}

export interface Prayer {
  id: number;
  meeting_date: string;
  name: string;
  opening_closing: string;
  notes: string;
}

export interface SacramentMusic {
  id: number;
  meeting_date: string;
  prelude_music: string;
  chorister: string;
  organist: string;
  opening_hymn: string;
  sacrament_hymn: string;
  rest_special: string;
  closing_hymn: string;
  postlude_music: string;
  child_blessing: string | null;
  confirmation: string | null;
  ordination: string | null;
  notes: string;
}

export interface SacramentTheme {
  id: number;
  meeting_date: string;
  theme: string;
  references_text: string;
  conducting: string;
  meeting_link: string;
  stake_business: string;
}

export interface SacramentAgendaNote {
  id: number;
  meeting_date: string;
  content: string;
  position: number;
}

export interface MemberNeed {
  id: number;
  who: string;
  what: string;
  type: string;
  notes: string;
  share_with: string;
  resolved: number;
  next_steps: string;
  pray_for: number;
}

export interface CalendarEvent {
  id: number;
  name: string;
  dates: string;
  notes: string;
  announce_in_sacrament: number;
  share_with: string;
}

export interface MissionaryPipeline {
  id: number;
  who: string;
  notes: string;
  mission_call: string;
  temple_status: string;
  next_steps: string;
  report_date: string;
  release_date: string;
  status: string;
}

export interface Baby {
  id: number;
  name: string;
  due_birth_date: string;
  status: string;
  blessing_date: string;
  notes: string;
  actions: string;
}

export interface ImportantLink {
  id: number;
  title: string;
  url: string;
  description: string;
}

export interface SacramentWardBusiness {
  id: number;
  meeting_date: string;
  sustainings_snapshot: string;   // JSON: AgendaCalling[]
  thanksgivings_snapshot: string; // JSON: AgendaCalling[]
}

export interface SacramentAnnouncement {
  id: number;
  meeting_date: string;
  title: string;
  notes: string;
}

export interface MemberWithoutCalling {
  id: number;
  name: string;
  potential_calling: string;
  notes: string;
}

export interface BishopScheduleEntry {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  notes: string;
}

export interface PrayerOther {
  id: number;
  name: string;
}
