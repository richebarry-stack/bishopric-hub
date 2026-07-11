import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Suspense, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';
import { lazyWithReload } from './lib/lazyWithReload';
import Layout from './components/Layout';
import Login from './pages/Login';
import ForceResetPassword from './pages/ForceResetPassword';
import SecurityQuestionsSetup from './pages/SecurityQuestionsSetup';
import ToastContainer from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';

const Dashboard = lazyWithReload(() => import('./pages/Dashboard'));
const CallingPipeline = lazyWithReload(() => import('./pages/CallingPipeline'));
const InterviewPipeline = lazyWithReload(() => import('./pages/InterviewPipeline'));
const Tasks = lazyWithReload(() => import('./pages/Tasks'));
const SacramentPlanning = lazyWithReload(() => import('./pages/SacramentPlanning'));
const CurrentSacrament = lazyWithReload(() => import('./pages/CurrentSacrament'));
const BishopricMeetings = lazyWithReload(() => import('./pages/BishopricMeetings'));
const MemberNeeds = lazyWithReload(() => import('./pages/MemberNeeds'));
const MissionaryPipeline = lazyWithReload(() => import('./pages/MissionaryPipeline'));
const Babies = lazyWithReload(() => import('./pages/Babies'));
const OutOfTown = lazyWithReload(() => import('./pages/OutOfTown'));
const Calendaring = lazyWithReload(() => import('./pages/Calendaring'));
const BishopSchedule = lazyWithReload(() => import('./pages/BishopSchedule'));
const Assignments = lazyWithReload(() => import('./pages/Assignments'));
const Users = lazyWithReload(() => import('./pages/Users'));
const EmailNotifications = lazyWithReload(() => import('./pages/EmailNotifications'));
const ImportantLinks = lazyWithReload(() => import('./pages/ImportantLinks'));
const Help = lazyWithReload(() => import('./pages/Help'));
const YouthActivities = lazyWithReload(() => import('./pages/YouthActivities'));
const SacramentProgram = lazyWithReload(() => import('./pages/SacramentProgram'));
const WardCouncilMembers = lazyWithReload(() => import('./pages/WardCouncilMembers'));
const SpeakersAndPrayers = lazyWithReload(() => import('./pages/SpeakersAndPrayers'));
const WardMembers = lazyWithReload(() => import('./pages/WardMembers'));
const WcDashboard = lazyWithReload(() => import('./pages/WcDashboard'));
const WcMeetings = lazyWithReload(() => import('./pages/WcMeetings'));
const WcWins = lazyWithReload(() => import('./pages/WcWins'));
const WcDiscussionTopics = lazyWithReload(() => import('./pages/WcDiscussionTopics'));
const HubSuggestions = lazyWithReload(() => import('./pages/HubSuggestions'));
const Ordinances = lazyWithReload(() => import('./pages/Ordinances'));
const AnnualDuties = lazyWithReload(() => import('./pages/AnnualDuties'));
const YcMeetings = lazyWithReload(() => import('./pages/YcMeetings'));
const MyActions = lazyWithReload(() => import('./pages/MyActions'));

const FullScreenLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <p className="text-gray-400">Loading...</p>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchInterval: 30_000 } },
});

function WcGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const wcPaths = [
    '/', '/my-actions', '/wc-meetings', '/wc-wins', '/wc-family-needs', '/wc-discussion-topics',
    '/current-sacrament', '/calendaring',
    '/babies', '/youth-activities', '/tasks', '/wc-members', '/hub-suggestions', '/help',
    '/yc-meetings',
  ];
  if (!wcPaths.includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function CalGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const calPaths = ['/calendaring', '/help'];
  if (!calPaths.includes(location.pathname)) {
    return <Navigate to="/calendaring" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading, selectedHub } = useAuth();
  const [securitySkipped, setSecuritySkipped] = useState(false);

  if (loading) {
    return <FullScreenLoading />;
  }

  if (!user) return <Login />;
  if (user.must_reset_password) return <ForceResetPassword />;
  if (!user.has_security_questions && !securitySkipped && user.role !== 'guest') return <SecurityQuestionsSetup onSkip={() => setSecuritySkipped(true)} />;

  // Calendar hub users
  if (user.hub === 'cal') {
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route path="/calendaring" element={<Calendaring />} />
          <Route path="/help" element={<Help />} />
          <Route path="*" element={<CalGuard><Calendaring /></CalGuard>} />
        </Route>
      </Routes>
    );
  }

  // Youth Council hub users and guests
  if (user.hub === 'yc') {
    // Sacrament-only guest: one page, no nav elsewhere
    if (user.role === 'guest' && user.church_role === 'sac') {
      return (
        <Routes>
          <Route element={<Layout />}>
            <Route path="/sacrament-program" element={<SacramentProgram />} />
            <Route path="*" element={<Navigate to="/sacrament-program" replace />} />
          </Route>
        </Routes>
      );
    }
    // Youth-calendar guest or regular YC user
    const isYcGuest = user.role === 'guest' && user.church_role === 'yc';
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route path="/youth-activities" element={<YouthActivities />} />
          {!isYcGuest && <Route path="/yc-meetings" element={<YcMeetings />} />}
          {!isYcGuest && <Route path="/help" element={<Help />} />}
          <Route path="*" element={<Navigate to="/youth-activities" replace />} />
        </Route>
      </Routes>
    );
  }

  // WC-only users always go to WC hub
  // Dual-access users in WC context also get WC routes
  if (user.hub === 'wc' || (user.hub === 'both' && selectedHub === 'wc')) {
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<WcDashboard />} />
          <Route path="/my-actions" element={<MyActions />} />
          <Route path="/wc-meetings" element={<WcMeetings />} />
          <Route path="/wc-wins" element={<WcWins />} />
          <Route path="/wc-family-needs" element={<MemberNeeds />} />
          <Route path="/wc-discussion-topics" element={<WcDiscussionTopics />} />
          <Route path="/current-sacrament" element={<CurrentSacrament />} />
          <Route path="/calendaring" element={<Calendaring />} />
          <Route path="/babies" element={<Babies />} />
          <Route path="/youth-activities" element={<YouthActivities />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/wc-members" element={<WardCouncilMembers />} />
          <Route path="/hub-suggestions" element={<HubSuggestions />} />
          <Route path="/yc-meetings" element={<YcMeetings />} />
          <Route path="/help" element={<Help />} />
          <Route path="*" element={<WcGuard><WcDashboard /></WcGuard>} />
        </Route>
      </Routes>
    );
  }

  // Bishopric hub (hub='both') — full access
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/my-actions" element={<MyActions />} />
        <Route path="/calling-pipeline" element={<CallingPipeline />} />
        <Route path="/interview-pipeline" element={<InterviewPipeline />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/sacrament-planning" element={<SacramentPlanning />} />
        <Route path="/current-sacrament" element={<CurrentSacrament />} />
        <Route path="/bishopric-meetings" element={<BishopricMeetings />} />
        <Route path="/member-needs" element={<MemberNeeds />} />
        <Route path="/missionary-pipeline" element={<MissionaryPipeline />} />
        <Route path="/babies" element={<Babies />} />
        <Route path="/out-of-town" element={<OutOfTown />} />
        <Route path="/calendaring" element={<Calendaring />} />
        <Route path="/bishop-schedule" element={<BishopSchedule />} />
        <Route path="/assignments" element={<Assignments />} />
        <Route path="/users" element={<Users />} />
        <Route path="/email-notifications" element={<EmailNotifications />} />
        <Route path="/important-links" element={<ImportantLinks />} />
        <Route path="/youth-activities" element={<YouthActivities />} />
        <Route path="/speakers-and-prayers" element={<SpeakersAndPrayers />} />
        <Route path="/ward-members" element={<WardMembers />} />
        <Route path="/ordinances" element={<Ordinances />} />
        <Route path="/annual-duties" element={<AnnualDuties />} />
        <Route path="/yc-meetings" element={<YcMeetings />} />
        <Route path="/hub-suggestions" element={<HubSuggestions />} />
        <Route path="/help" element={<Help />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ConfirmProvider>
            <Suspense fallback={<FullScreenLoading />}>
              <AppRoutes />
            </Suspense>
            <ToastContainer />
          </ConfirmProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
