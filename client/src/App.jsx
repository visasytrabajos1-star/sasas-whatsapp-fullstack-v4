import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { AuthProvider } from './auth/AuthContext';

const Login = lazy(() => import('./components/Login'));
const LandingPage = lazy(() => import('./components/LandingPage'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const OnboardingWizard = lazy(() => import('./components/Onboarding/OnboardingWizard'));
const PaymentSetup = lazy(() => import('./components/PaymentSetup'));
const SaasDashboard = lazy(() => import('./components/SaasDashboard'));
const SuperAdminDashboard = lazy(() => import('./components/SuperAdminDashboard'));

if (import.meta.env.DEV) {
  console.log('📦 [ALEX IO] App loaded in development mode');
}

const FullPageLoader = ({ label = 'CARGANDO ALEX IO...' }) => (
  <div
    style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
    }}
  >
    <div
      style={{
        width: 48,
        height: 48,
        border: '4px solid #3b82f6',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
    <p style={{ marginTop: 16, color: '#94a3b8', fontSize: 12, letterSpacing: 2 }}>{label}</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
  </div>
);

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let didCancel = false;

    const finishLoading = (sess) => {
      if (!didCancel) {
        setSession(sess);
        setLoading(false);
      }
    };

    const buildJwtSession = () => {
      try {
        const token = localStorage.getItem('alex_io_token');
        if (!token) return null;
        return {
          user: {
            id: 'jwt-user',
            email: localStorage.getItem('demo_email') || 'user@app.com',
            role: localStorage.getItem('alex_io_role') || 'OWNER',
            tenantId: localStorage.getItem('alex_io_tenant') || '',
          },
          access_token: token,
        };
      } catch {
        return null;
      }
    };

    if (localStorage.getItem('demo_mode') === 'true') {
      finishLoading({ user: { id: 'demo', email: 'admin@demo.com', role: 'SUPERADMIN' } });
      return;
    }

    if (!supabase) {
      finishLoading(buildJwtSession());
      return;
    }

    const safetyTimer = setTimeout(() => {
      console.warn('⏰ Safety timeout');
      finishLoading(buildJwtSession());
    }, 3000);

    try {
      supabase.auth
        .getSession()
        .then(({ data }) => {
          clearTimeout(safetyTimer);
          const s = data?.session;
          if (s) {
            try {
              localStorage.setItem('alex_io_token', s.access_token);
              localStorage.setItem('demo_email', s.user?.email || '');
            } catch {
              // no-op
            }
            finishLoading(s);
          } else {
            finishLoading(buildJwtSession());
          }
        })
        .catch(() => {
          clearTimeout(safetyTimer);
          finishLoading(buildJwtSession());
        });
    } catch {
      clearTimeout(safetyTimer);
      finishLoading(buildJwtSession());
    }

    let subscription;
    try {
      const result = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (newSession) {
          try {
            localStorage.setItem('alex_io_token', newSession.access_token);
            localStorage.setItem('demo_email', newSession.user?.email || '');
          } catch {
            // no-op
          }
          setSession(newSession);
        } else {
          setSession(buildJwtSession());
        }
      });
      subscription = result?.data?.subscription;
    } catch {
      // no-op
    }

    return () => {
      didCancel = true;
      try {
        subscription?.unsubscribe();
      } catch {
        // no-op
      }
    };
  }, []);

  if (loading) {
    return <FullPageLoader label="CARGANDO ALEX IO..." />;
  }

  const ProtectedRoute = ({ children }) => {
    if (!session) return <Navigate to="/login" />;
    return children;
  };

  const RoleRoute = ({ children, allowedRoles }) => {
    if (!session) return <Navigate to="/login" />;
    const role = session.user?.role || localStorage.getItem('alex_io_role') || 'OWNER';
    if (!allowedRoles.includes(role)) return <Navigate to="/dashboard" />;
    return children;
  };

  const defaultPath = session?.user?.role === 'SUPERADMIN' ? '/admin' : '/dashboard';

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-black selection:bg-blue-500/30">
          <Suspense fallback={<FullPageLoader />}>
            <Routes>
              <Route path="/login" element={!session ? <Login /> : <Navigate to={defaultPath} />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <SaasDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <RoleRoute allowedRoles={['SUPERADMIN']}>
                    <AdminDashboard />
                  </RoleRoute>
                }
              />

              <Route
                path="/superadmin"
                element={
                  <RoleRoute allowedRoles={['SUPERADMIN']}>
                    <SuperAdminDashboard />
                  </RoleRoute>
                }
              />

              <Route path="/saas" element={<SaasDashboard />} />
              <Route
                path="/payment-setup"
                element={
                  <ProtectedRoute>
                    <PaymentSetup />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <OnboardingWizard session={session} onComplete={() => { }} />
                  </ProtectedRoute>
                }
              />

              <Route path="/" element={<LandingPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
