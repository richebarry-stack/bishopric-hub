const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

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
    throw new ApiError('Unauthorized', 401);
  }
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Request failed', res.status, data);
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
    changePassword: (currentPassword: string | null, newPassword: string) =>
      request('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) }),
    getSecurityQuestions: (email: string) =>
      request<{ question1: string; question2: string }>(`/auth/security-questions?email=${encodeURIComponent(email)}`),
    saveSecurityQuestions: (data: { question1: string; answer1: string; question2: string; answer2: string }) =>
      request('/auth/security-questions', { method: 'POST', body: JSON.stringify(data) }),
    resetByQuestions: (data: { email: string; answer1: string; answer2: string; new_password: string }) =>
      request('/auth/reset-by-questions', { method: 'POST', body: JSON.stringify(data) }),
    guest: (type: 'yc' | 'sac') =>
      request<{ user: User }>(`/auth/guest/${type}`, { method: 'POST' }),
  },
  users: {
    list: (filter?: 'wc') => request<User[]>(`/users${filter ? `?hub=${filter}` : ''}`),
    setHub: (id: number, hub: string) =>
      request<User>(`/users/${id}/hub`, { method: 'PUT', body: JSON.stringify({ hub }) }),
  },
  navLabels: {
    get: () => request<{ path: string; label: string }[]>('/nav-labels'),
    set: (labels: Record<string, string>) =>
      request('/nav-labels', { method: 'POST', body: JSON.stringify(labels) }),
  },
  registrationRequests: {
    list: () => request<RegistrationRequest[]>('/registration-requests'),
    update: (id: number, data: Partial<RegistrationRequest>) =>
      request<RegistrationRequest>(`/registration-requests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    approve: (id: number, hub?: string) =>
      request(`/registration-requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ hub }) }),
    reject: (id: number) =>
      request(`/registration-requests/${id}`, { method: 'DELETE' }),
    submit: (data: { name: string; email: string; church_role: string; password: string }) =>
      request('/auth/register-request', { method: 'POST', body: JSON.stringify(data) }),
  },
  speakerNotes: {
    getAll: () => request<{ person_name: string; category: string; notes: string }[]>('/speaker-notes'),
    save: (person_name: string, category: string, notes: string) =>
      request('/speaker-notes', { method: 'POST', body: JSON.stringify({ person_name, category, notes }) }),
  },
  emailSettings: {
    get: () => request<Record<string, unknown>>('/email-settings'),
    save: (settings: Record<string, unknown>) =>
      request('/email-settings', { method: 'PUT', body: JSON.stringify(settings) }),
    preview: (type: string) =>
      request<Record<string, unknown>>('/email-preview', { method: 'POST', body: JSON.stringify({ type }) }),
  },
  wardMembers: {
    import: (data: {
      updates: { id: number; birth_date: string }[];
      creates: { name: string; birth_date: string | null }[];
      deactivate: number[];
    }) => request<{ ok: true; updated: number; created: number; deactivated: number }>('/ward-members/import', {
      method: 'POST', body: JSON.stringify(data),
    }),
  },
  automationStatus: {
    get: () => request<{ last_run: string | null; results: Record<string, { ok: boolean; error?: string; [key: string]: unknown }> }>('/automation-status'),
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
  hub: string;
  last_login?: string;
  last_access?: string;
  must_reset_password?: boolean;
  has_security_questions?: boolean;
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
  updated_at: string;
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
  due_date: string;
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
  recurrence_id: string | null;
  recurrence_interval_weeks: number | null;
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

export interface WcMeeting {
  id: number;
  date: string;
  opening_prayer: string;
  spiritual_thought: string;
  closing_prayer: string;
}

export interface WcWin {
  id: number;
  date: string;
  description: string;
}

export interface WcFamilyNeed {
  id: number;
  family_name: string;
  details: string;
  status: string;
  assignments: string;
}

export interface WcDiscussionTopic {
  id: number;
  meeting_date: string;
  organization: string;
  topic: string;
  status: string;
  next_steps: string;
  help_needed: string;
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
  presiding: string;
  conducting: string;
  meeting_link: string;
  stake_business: string;
  ward_business: string;
  intro_remarks: string;
  recognize: string;
  closing_remarks: string;
  is_fast_sunday: number;
  sacrament_intro: string;
  high_councilor: string;
  stake_reps: string;
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
  shared_with_wc: number;
  updated_at: string;
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

export interface SacramentAgendaExclusion {
  id: number;
  meeting_date: string;
  calling_id: number;
  type: 'sustain' | 'thank';
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

export interface YouthActivity {
  id: number;
  date: string;
  time: string;
  location: string;
  builders_of_faith: string;
  builders_of_faith_time: string;
  builders_of_faith_location: string;
  messengers_of_hope: string;
  messengers_of_hope_time: string;
  messengers_of_hope_location: string;
  gatherers_of_light: string;
  gatherers_of_light_time: string;
  gatherers_of_light_location: string;
  deacons: string;
  deacons_time: string;
  deacons_location: string;
  teachers: string;
  teachers_time: string;
  teachers_location: string;
  priests: string;
  priests_time: string;
  priests_location: string;
  notes: string;
  updated_at: string;
}

export interface RegistrationRequest {
  id: number;
  name: string;
  email: string;
  church_role: string;
  requested_at: string;
}

export interface BishopScheduleEntry {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  notes: string;
  recurrence_id?: string | null;
  recurrence_frequency?: 'daily' | 'weekly' | 'monthly_nth_weekday' | null;
  recurrence_interval?: number | null;
  recurrence_end_date?: string | null;
}

export interface PrayerOther {
  id: number;
  name: string;
}

export interface HubSuggestion {
  id: number;
  type: string;
  title: string;
  description: string;
  submitted_by: string;
  status: string;
  admin_notes: string;
  updated_at: string;
}

export interface WardMember {
  id: number;
  name: string;
  active: number;
  exclude_speakers: number;
  exclude_prayers: number;
  birth_date: string | null;
  updated_at: string;
}
