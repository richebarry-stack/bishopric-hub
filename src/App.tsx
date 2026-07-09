import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CallingPipeline from './pages/CallingPipeline';
import InterviewPipeline from './pages/InterviewPipeline';
import Tasks from './pages/Tasks';
import SacramentPlanning from './pages/SacramentPlanning';
import CurrentSacrament from './pages/CurrentSacrament';
import BishopricMeetings from './pages/BishopricMeetings';
import MemberNeeds from './pages/MemberNeeds';
import MissionaryPipeline from './pages/MissionaryPipeline';
import Babies from './pages/Babies';
import OutOfTown from './pages/OutOfTown';
import Calendaring from './pages/Calendaring';
import BishopSchedule from './pages/BishopSchedule';
import Assignments from './pages/Assignments';
import Users from './pages/Users';
import EmailNotifications from './pages/EmailNotifications';
import ImportantLinks from './pages/ImportantLinks';
import ForceResetPassword from './pages/ForceResetPassword';
import SecurityQuestionsSetup from './pages/SecurityQuestionsSetup';
import Help from './pages/Help';
import YouthActivities from './pages/YouthActivities';
import SacramentProgram from './pages/SacramentProgram';
import WardCouncilMembers from './pages/WardCouncilMembers';
import SpeakersAndPrayers from './pages/SpeakersAndPrayers';
import WardMembers from './pages/WardMembers';
import WcDashboard from './pages/WcDashboard';
import WcMeetings from './pages/WcMeetings';
import WcWins from './pages/WcWins';
import WcDiscussionTopics from './pages/WcDiscussionTopics';
import HubSuggestions from './pages/HubSuggestions';
import ToastContainer from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchInterval: 30_000 } },
});

function WcGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const wcPaths = [
    '/', '/wc-meetings', '/wc-wins', '/wc-family-needs', '/wc-discussion-topics',
    '/current-sacrament', '/calendaring',
    '/babies', '/youth-activities', '/tasks', '/wc-members', '/hub-suggestions', '/help',
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
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
            <AppRoutes />
            <ToastContainer />
          </ConfirmProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
