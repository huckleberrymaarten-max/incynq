import { BrowserRouter } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ContentProvider } from './context/ContentContext';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import logo from './assets/Q_Logo_.png';
import { getProfile } from './lib/db';

// Screens
import OnboardingScreen from './screens/OnboardingScreen';
import AuthScreen       from './screens/AuthScreen';
import PendingScreen    from './screens/PendingScreen';
import MainApp          from './screens/MainApp';
import Toast            from './components/Toast';

function AppRoutes() {
  const { loggedIn, showOnboarding, currentUser, setLoggedIn, setShowOnboarding, setCurrentUser, setLinkedProfiles, notif, setFollowing } = useApp();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      console.log('Session check running');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session:', session);

      if (session?.user) {
        try {
          console.log('Fetching profile for:', session.user.id);
          const profile = await getProfile(session.user.id);
          console.log('Profile:', profile);
          setCurrentUser({
            id: session.user.id,
            username: profile.username,
            displayName: profile.display_name,
            name: profile.display_name,
            showDisplayName: profile.show_display_name,
            avatar: profile.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(profile.username)}&backgroundColor=b6e3f4`,
            bio: profile.bio || '',
            groups: profile.groups || [],
            subs: profile.subs || [],
            gridStatus: profile.grid_status || 'online',
            accountType: profile.account_type || 'resident',
            wallet: profile.wallet || 0,
            maturity: profile.maturity || 'general',
            activated: profile.activated,
            createdAt: profile.created_at,
          });

          // Load follows from Supabase
          try {
            const { getFollows } = await import('./lib/db');
            const followSet = await getFollows(session.user.id);
            const merged = new Set([...followSet]);
            merged.add(0); // Always follow InCynq official
            setFollowing(merged);
          } catch(e) {
            console.warn('Could not load follows:', e.message);
          }

          setShowOnboarding(false);
          setLoggedIn(true);
        } catch (e) {
          console.log('Profile fetch error:', e.message);
          await supabase.auth.signOut();
        }
      } else {
        console.log('No session found');
      }
      setChecking(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event);
      if (event === 'SIGNED_OUT') {
        setLoggedIn(false);
        setShowOnboarding(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: '#040f14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={logo} alt="InCynq" style={{ width: 80, height: 80, objectFit: 'contain', opacity: .8, animation: 'float 3s ease-in-out infinite' }} />
      </div>
    );
  }

  if (!loggedIn && showOnboarding) {
    return <OnboardingScreen onDone={() => setShowOnboarding(false)} />;
  }

  if (!loggedIn) {
    return (
      <AuthScreen
        onLogin={u => {
          setCurrentUser(u);
          setLinkedProfiles(prev => [{ ...prev[0], ...u, id: 1 }, ...prev.slice(1)]);
          setLoggedIn(true);
        }}
      />
    );
  }

  if (currentUser.activated === false) {
    return (
      <PendingScreen
        currentUser={currentUser}
        onActivate={(updates = {}) => setCurrentUser(u => ({ ...u, activated: true, ...updates }))}
        onSignOut={async () => {
          await supabase.auth.signOut();
          setLoggedIn(false);
        }}
      />
    );
  }

  return (
    <>
      <MainApp />
      {notif && <Toast msg={notif.msg} type={notif.type} />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <ContentProvider>
          <AppRoutes />
        </ContentProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
