import { BrowserRouter } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ContentProvider } from './context/ContentContext';
import { useEffect } from 'react';
import { supabase } from './lib/supabase';
import { getProfile } from './lib/db';
import { ME } from './data';

// Screens
import OnboardingScreen from './screens/OnboardingScreen';
import AuthScreen       from './screens/AuthScreen';
import PendingScreen    from './screens/PendingScreen';
import MainApp          from './screens/MainApp';
import Toast            from './components/Toast';

function AppRoutes() {
  const { loggedIn, showOnboarding, currentUser, setLoggedIn, setShowOnboarding, setCurrentUser, setLinkedProfiles, notif } = useApp();

  // Check for existing session on load
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        try {
          const profile = await getProfile(session.user.id);
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
          });
          setShowOnboarding(false);
          setLoggedIn(true);
        } catch (e) {
          // Profile not found — sign out
          await supabase.auth.signOut();
        }
      }
    };
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setLoggedIn(false);
        setShowOnboarding(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
