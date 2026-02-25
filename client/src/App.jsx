import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Login from './components/Login';

import LandingPage from './components/LandingPage';
import WhatsAppConnect from './components/WhatsAppConnect';

import AdminDashboard from './components/AdminDashboard';
import OnboardingWizard from './components/Onboarding/OnboardingWizard';
import PaymentSetup from './components/PaymentSetup';
import SaasDashboard from './components/SaasDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';

console.log("📦 [ALEX IO] App Registry Loaded");

function App() {
  console.log("🛸 [ALEX IO] App Component Rendering Started");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🔄 [ALEX IO] Initializing Session Check...");
    const demoMode = localStorage.getItem('demo_mode') === 'true';

    if (demoMode) {
      console.warn("🛡️ [ALEX IO] DEMO MODE ACTIVE");
      setSession({
        user: { id: 'demo-admin-id', email: 'admin@demo.com' }
      });
      setLoading(false);
      return;
    }

    // Helper: build a session from our own JWT stored in localStorage
    const buildJwtSession = () => {
      const backendToken = localStorage.getItem('alex_io_token');
      if (!backendToken) return null;
      const demoEmail = localStorage.getItem('demo_email') || 'user@app.com';
      const userRole = localStorage.getItem('alex_io_role') || 'OWNER';
      const tenantId = localStorage.getItem('alex_io_tenant') || '';
      console.log("🔑 [ALEX IO] Backend JWT found for:", demoEmail, "role:", userRole);
      return {
        user: { id: 'backend-jwt-user', email: demoEmail, role: userRole, tenantId },
        access_token: backendToken
      };
    };

    if (!supabase) {
      console.warn("⚠️ [ALEX IO] Supabase client is NULL or missing config");
      const jwtSession = buildJwtSession();
      if (jwtSession) setSession(jwtSession);
      setLoading(false);
      return;
    }

    // SAFETY TIMEOUT: never hang on loading forever
    const safetyTimer = setTimeout(() => {
      console.warn('⏰ [ALEX IO] Safety timeout - forcing loading=false');
      setLoading(false);
    }, 3000);

    supabase.auth.getSession().then(({ data: { session: supabaseSession } }) => {
      clearTimeout(safetyTimer);
      if (supabaseSession) {
        // Google OAuth session
        console.log("🔑 [ALEX IO] Supabase OAuth session active");
        setSession(supabaseSession);
      } else {
        // No Supabase session — check for our own JWT (email/password login)
        const jwtSession = buildJwtSession();
        if (jwtSession) {
          setSession(jwtSession);
        } else {
          console.log("⚠️ [ALEX IO] No active session found");
          setSession(null);
        }
      }
      setLoading(false);
    }).catch(err => {
      clearTimeout(safetyTimer);
      console.error("❌ [ALEX IO] Auth Check Failure:", err);
      // On error, still try JWT fallback
      const jwtSession = buildJwtSession();
      if (jwtSession) setSession(jwtSession);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (newSession) {
        // Save Supabase token for backend API calls
        localStorage.setItem('alex_io_token', newSession.access_token);
        localStorage.setItem('demo_email', newSession.user?.email || '');
        localStorage.setItem('alex_io_role', newSession.user?.role || 'OWNER');
        setSession(newSession);
      }
      // Don't clear JWT session on Supabase state changes if no new session
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white p-6 font-sans">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 animate-pulse font-bold tracking-widest uppercase text-xs">Cargando ALEX IO...</p>
      </div>
    );
  }

  const ProtectedRoute = ({ children }) => {
    if (!session) return <Navigate to="/login" />;
    return children;
  };

  const AdminRoute = ({ children }) => {
    if (!session) return <Navigate to="/login" />;
    const role = session.user?.role || localStorage.getItem('alex_io_role') || 'OWNER';
    if (role !== 'SUPERADMIN') return <Navigate to="/dashboard" />;
    return children;
  };

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-black selection:bg-blue-500/30">
          <Routes>
            <Route path="/login" element={!session ? <Login /> : <Navigate to={session.user?.role === 'SUPERADMIN' ? '/admin' : '/dashboard'} />} />

            <Route path="/dashboard" element={
              <ProtectedRoute>
                <SaasDashboard />
              </ProtectedRoute>
            } />

            <Route path="/admin" element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } />

            <Route path="/superadmin" element={
              <ProtectedRoute>
                <SuperAdminDashboard />
              </ProtectedRoute>
            } />

            <Route path="/saas" element={<SaasDashboard />} />
            <Route path="/payment-setup" element={<ProtectedRoute><PaymentSetup /></ProtectedRoute>} />
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <OnboardingWizard session={session} onComplete={() => { }} />
              </ProtectedRoute>
            } />

            <Route path="/" element={<LandingPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
