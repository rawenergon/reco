
import React, { useState, useEffect, Suspense } from 'react';
import { AppView } from './types';
import { DEFAULT_CONFIG } from './constants';
import { initSupabase, getSession } from './services/supabase';
import { initGemini } from './services/gemini';
import { Loader2, Book } from 'lucide-react';
import { AuthModal } from './components/AuthModal';

// Lazy load heavy components for performance
const Kiosk = React.lazy(() => import('./components/Kiosk').then(m => ({ default: m.Kiosk })));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const Docs = React.lazy(() => import('./components/Docs').then(m => ({ default: m.Docs })));

const LoadingScreen = () => (
  <div className="flex h-[80vh] w-full items-center justify-center">
    <Loader2 className="w-6 h-6 animate-spin text-content-secondary" />
  </div>
);

function App() {
  const [view, setView] = useState<AppView>(AppView.KIOSK);
  const [showLogin, setShowLogin] = useState(false);

  // Initialize services ONCE on mount
  useEffect(() => {
    // 1. Initialize Supabase (Force Hardcoded Config)
    const sbUrl = DEFAULT_CONFIG.SUPABASE_URL;
    const sbKey = DEFAULT_CONFIG.SUPABASE_KEY;
    
    if (sbUrl && sbKey) {
        initSupabase(sbUrl, sbKey);
    }

    // 2. Initialize Gemini (Force Hardcoded Config)
    const gemKey = DEFAULT_CONFIG.GEMINI_API_KEY;
    if (gemKey) {
      initGemini(gemKey);
    } else {
      console.error("CRITICAL: No Gemini API Key found. AI features will fail.");
    }
  }, []);

  const handleAdminClick = async () => {
    if (view === AppView.ADMIN_DASHBOARD) {
        // CLOSE ADMIN: Go to Kiosk
        setView(AppView.KIOSK);
        setShowLogin(false);
    } else {
        // OPEN ADMIN: Check session
        const session = await getSession();
        if (session) {
            setView(AppView.ADMIN_DASHBOARD);
        } else {
            // Show login modal
            setShowLogin(true);
        }
    }
  };

  const handleLoginSuccess = () => {
      setShowLogin(false);
      setView(AppView.ADMIN_DASHBOARD);
  };

  const handleLoginCancel = () => {
      setShowLogin(false);
      // Stay on current view (Kiosk)
  }

  const handleLogout = () => {
      setView(AppView.KIOSK);
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 text-content-primary font-sans transition-colors duration-300">
      
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4 pointer-events-none">
        <div className="pointer-events-auto bg-surface-50/50 dark:bg-black/50 backdrop-blur-md px-4 py-1 rounded-full border border-surface-200 dark:border-white/10 flex items-center gap-2">
            <span className="text-lg font-light tracking-[0.2em] text-content-primary">RECO</span>
        </div>
        
        <div className="flex items-center gap-2">
            {view !== AppView.DOCS && (
                <button
                    onClick={() => setView(AppView.DOCS)}
                    className="pointer-events-auto p-2 rounded-full bg-surface-50/50 dark:bg-black/50 backdrop-blur-md border border-surface-200 dark:border-white/10 text-content-secondary hover:text-content-primary transition-colors"
                    title="Documentation"
                >
                    <Book className="w-4 h-4" />
                </button>
            )}

            <button 
                type="button"
                onClick={handleAdminClick}
                className="pointer-events-auto text-xs font-medium text-content-secondary hover:text-content-primary transition-colors uppercase tracking-widest bg-surface-50/50 dark:bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-surface-200 dark:border-white/10 cursor-pointer"
            >
                {view === AppView.ADMIN_DASHBOARD ? 'Close' : 'Admin'}
            </button>
        </div>
      </header>

      <main className="pt-16 min-h-screen flex flex-col">
        <Suspense fallback={<LoadingScreen />}>
          {view === AppView.KIOSK && <Kiosk />}
          {view === AppView.ADMIN_DASHBOARD && <AdminDashboard onLogout={handleLogout} />}
          {view === AppView.DOCS && <Docs onBack={() => setView(AppView.KIOSK)} />}
        </Suspense>
      </main>

      {showLogin && (
          <AuthModal 
            onLoginSuccess={handleLoginSuccess} 
            onCancel={handleLoginCancel} 
          />
      )}
    </div>
  );
}

export default App;
