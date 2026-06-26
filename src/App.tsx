import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import ImportantLinks from './pages/ImportantLinks';
import ForceResetPassword from './pages/ForceResetPassword';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 0, retry: 1 } },
});

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!user) return <Login />;
  if (user.must_reset_password) return <ForceResetPassword />;

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
        <Route path="/important-links" element={<ImportantLinks />} />
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
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
