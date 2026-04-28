import { BrowserRouter } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ContentProvider } from './context/ContentContext';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabase';
import logo from './assets/Q_Logo_.png';
import { getProfile, cancelAccountDeletion } from './lib/db';

// Screens
import OnboardingScreen    from './screens/OnboardingScreen';
import AuthScreen          from './screens/AuthScreen';
import PendingScreen       from './screens/PendingScreen';
import DeactivatedScreen   from './screens/DeactivatedScreen';
import MainApp             from './screens/MainApp';
import Toast               from './components/Toast';

// ── Deletion countdown banner ─────────────────────────────────
// Shown inside the app while a deletion request is pending.
// User can cancel from here during the cool-off window.
function DeletionBanner({ requestedAt, accountType, onCancel }) {
  const [cancelling, setCancelling] = useState(false);

  const graceDays  = accountType === 'brand' || accountType === 'founding_brand' ? 30 : 14;
  const deleteDate = new Date(requestedAt);
  deleteDate.setDate(deleteDate.getDate() + graceDays);

  const daysLeft = Math.max(
    0,
    Math.ceil((deleteDate - Date.now()) / (1000 * 60 * 60 * 24))
  );

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await onCancel();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div style={{
      background:     '#7B1818',
      borderBottom:   '1px solid #a82222',
      padding:        '10px 16px',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      gap:            12,
      flexWrap:       'wrap',
      zIndex:         9999,
      position:       'sticky',
      top:            0,
    }}>
      <span style={{ color: '#fff', fontSize: 13, lineHeight: 1.4 }}>
        ⚠️ Your account is scheduled for deletion in{' '}
        <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong>
        {' '}({deleteDate.toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}).
        All your data will be permanently removed.
      </span>
      <button
        onClick={handleCancel}
        disabled={cancelling}
        style={{
          background:   'transparent',
          border:       '1px solid rgba(255,255,255,0.6)',
          borderRadius: 6,
          color:        '#fff',
          fontSize:     13,
          padding:      '4px 12px',
          cursor:       'pointer',
          whiteSpace:   'nowrap',
          flexShrink:   0,
        }}
      >
        {cancelling ? 'Cancelling…' : 'Cancel deletion'}
      </button>
    </div>
  );
}

function AppRoutes() {
  const {
    loggedIn, showOnboarding,
    currentUser,
    setLoggedIn, setShowOnboarding, setCurrentUser, setLinkedProfiles,
    notif, setFollowing, setSaved, setDiscoverable, setGridStatus,
    setMyGroups, setMySubs, setNotifications,
  } = useApp();
  const [checking, setChecking] = useState(true);

  // ═══════════════════════════════════════════════════════════════
  // HYDRATE PROFILE — single source of truth for ALL login paths
  // Called by: session restore (page reload) AND manual login
  // Reads every persisted field from Supabase and pushes into state
  // ═══════════════════════════════════════════════════════════════
  const hydrateProfile = useCallback(async (userId) => {
    if (!userId) return null;

    try {
      const profile = await getProfile(userId);
      if (!profile) return null;

      // ── 1. Push ALL profile fields into currentUser ──────────
      setCurrentUser({
        id:              userId,
        username:        profile.username,
        displayName:     profile.display_name,
        name:            profile.display_name,
        showDisplayName: profile.show_display_name,
        avatar:          profile.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(profile.username)}&backgroundColor=b6e3f4`,
        bio:             profile.bio || '',
        groups:          profile.groups || [],
        subs:            profile.subs || [],
        gridStatus:      profile.grid_status || 'online',
        accountType:     profile.account_type || 'resident',
        adminRole:       profile.admin_role || null,
        wallet:          profile.wallet || 0,
        maturity:        profile.maturity || 'general',
        activated:       profile.activated,
        createdAt:       profile.created_at,
        // Founding brand & dates
        foundingBrandNumber:  profile.founding_brand_number  || null,
        brandJoinedAt:        profile.brand_joined_at        || null,
        activatedAt:          profile.activated_at           || null,
        // Lifecycle fields
        deactivatedAt:        profile.deactivated_at         || null,
        deletionRequestedAt:  profile.deletion_requested_at  || null,
      });

      // ── 2. Push parallel AppContext flags (separate state) ───
      setDiscoverable(profile.discoverable !== false);
      setGridStatus(profile.grid_status || 'online');
      if (Array.isArray(profile.groups)) setMyGroups(profile.groups);
      if (Array.isArray(profile.subs))   setMySubs(profile.subs);

      // ── 3. Update linkedProfiles (for account switcher) ──────
      setLinkedProfiles(prev => {
        const others = prev.filter(p => p.id !== userId);
        return [{
          id:          userId,
          username:    profile.username,
          displayName: profile.display_name,
          avatar:      profile.avatar_url,
          accountType: profile.account_type || 'resident',
          wallet:      profile.wallet || 0,
        }, ...others];
      });

      // ── 4. Hydrate related collections (follows, saves, notifications) ──
      const [follows, saves, notifs] = await Promise.allSettled([
        import('./lib/db').then(({ getFollows })        => getFollows(userId)),
        import('./lib/db').then(({ getSaved })          => getSaved(userId)),
        import('./lib/db').then(({ getNotifications }) => getNotifications(userId)),
      ]);

      if (follows.status === 'fulfilled' && follows.value) {
        const merged = new Set([...follows.value]);
        merged.add(0); // Always follow InCynq official
        setFollowing(merged);
      } else if (follows.status === 'rejected') {
        console.warn('Could not load follows:', follows.reason?.message);
      }

      if (saves.status === 'fulfilled' && saves.value) {
        setSaved(saves.value);
      } else if (saves.status === 'rejected') {
        console.warn('Could not load saves:', saves.reason?.message);
      }

      if (notifs.status === 'fulfilled' && notifs.value) {
        setNotifications(notifs.value);
      } else if (notifs.status === 'rejected') {
        console.warn('Could not load notifications:', notifs.reason?.message);
      }

      return profile;
    } catch (e) {
      console.error('hydrateProfile failed:', e.message);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // SESSION CHECK — runs on app mount (page reload, return visit)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const checkSession = async () => {
      console.log('Session check running');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session:', session);

      if (session?.user) {
        try {
          console.log('Hydrating profile for:', session.user.id);
          const profile = await hydrateProfile(session.user.id);

          if (!profile) {
            console.log('No profile found, signing out');
            await supabase.auth.signOut();
            setChecking(false);
            return;
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
        setNotifications([]);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Loading splash ──────────────────────────────────────────
  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: '#040f14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={logo} alt="InCynq" style={{ width: 80, height: 80, objectFit: 'contain', opacity: .8, animation: 'float 3s ease-in-out infinite' }} />
      </div>
    );
  }

  // ── Not logged in ───────────────────────────────────────────
  if (!loggedIn && showOnboarding) {
    return <OnboardingScreen onDone={() => setShowOnboarding(false)} />;
  }

  if (!loggedIn) {
    return (
      <AuthScreen
        onLogin={async (u) => {
          if (u?.id) {
            const profile = await hydrateProfile(u.id);
            if (!profile) {
              console.warn('hydrateProfile returned null, using AuthScreen payload');
              setCurrentUser(u);
              setLinkedProfiles(prev => [{ ...prev[0], ...u, id: 1 }, ...prev.slice(1)]);
            }
          } else {
            setCurrentUser(u);
            setLinkedProfiles(prev => [{ ...prev[0], ...u, id: 1 }, ...prev.slice(1)]);
          }
          setLoggedIn(true);
        }}
      />
    );
  }

  // ── Pending activation ──────────────────────────────────────
  if (currentUser.activated === false) {
    return (
      <PendingScreen
        currentUser={currentUser}
        onActivate={(updates = {}) => setCurrentUser(u => ({ ...u, activated: true, wallet: 100, ...updates }))}
        onSignOut={async () => {
          await supabase.auth.signOut();
          setLoggedIn(false);
        }}
      />
    );
  }

  // ── Deactivated — show reactivation screen ──────────────────
  if (currentUser.deactivatedAt) {
    return (
      <DeactivatedScreen
        currentUser={currentUser}
        onReactivate={() => setCurrentUser(u => ({ ...u, deactivatedAt: null }))}
        onSignOut={async () => {
          await supabase.auth.signOut();
          setLoggedIn(false);
        }}
      />
    );
  }

  // ── Active — main app (with optional deletion banner) ───────
  const handleCancelDeletion = async () => {
    try {
      await cancelAccountDeletion(currentUser.id);
      setCurrentUser(u => ({ ...u, deletionRequestedAt: null }));
    } catch (e) {
      console.error('Cancel deletion failed:', e.message);
    }
  };

  return (
    <>
      {currentUser.deletionRequestedAt && (
        <DeletionBanner
          requestedAt={currentUser.deletionRequestedAt}
          accountType={currentUser.accountType}
          onCancel={handleCancelDeletion}
        />
      )}
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
