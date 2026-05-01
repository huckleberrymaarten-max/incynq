import { useState, useRef, useEffect } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import Av from '../components/Av';

import FeedScreen        from './FeedScreen';
import SearchScreen      from './SearchScreen';
import EventsScreen      from './EventsScreen';
import AdvertiseScreen   from './AdvertiseScreen';
import ProfileScreen     from './ProfileScreen';
import UserProfileScreen from './UserProfileScreen';

const NAV = [
  { id: 'feed',      icon: '🏠', label: 'Home'      },
  { id: 'search',    icon: '🔍', label: 'Search'    },
  { id: 'events',    icon: '🎉', label: 'Events'    },
  { id: 'advertise', icon: '📢', label: 'Advertise' },
  { id: 'profile',   icon: '👤', label: 'Profile'   },
];

// ── Account mode switcher dropdown ───────────────────────────
function AccountSwitcher({ currentUser, onSwitch }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);
  const isBrand         = currentUser.accountType === 'brand' || currentUser.accountType === 'founding_brand';
  const inBrandMode     = currentUser.brandMode === true;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // If no brand, just show name — no dropdown
  if (!isBrand) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Av user={currentUser} size={28} />
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentUser.displayName || currentUser.username}
        </span>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        8,
          background: open ? 'rgba(0,180,200,0.1)' : 'transparent',
          border:     `1px solid ${open ? 'rgba(0,180,200,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 20,
          padding:    '4px 10px 4px 4px',
          cursor:     'pointer',
          transition: 'all 0.15s',
        }}
      >
        {/* Avatar or brand logo */}
        {inBrandMode && currentUser.brandLogoUrl
          ? <img src={currentUser.brandLogoUrl} alt="brand" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
          : <Av user={currentUser} size={28} />
        }
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {inBrandMode ? currentUser.brandName : (currentUser.displayName || currentUser.username)}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginLeft: -2 }}>▼</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:   'absolute',
          top:        '110%',
          left:       0,
          minWidth:   220,
          background: '#0d1f2d',
          border:     '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          boxShadow:  '0 8px 32px rgba(0,0,0,0.5)',
          overflow:   'hidden',
          zIndex:     500,
        }}>
          <div style={{ padding: '8px 14px 6px', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
            SWITCH ACCOUNT
          </div>

          {/* Resident option */}
          <button
            onClick={() => { onSwitch('resident'); setOpen(false); }}
            style={{
              width:      '100%',
              padding:    '10px 14px',
              display:    'flex',
              alignItems: 'center',
              gap:        10,
              background: !inBrandMode ? 'rgba(0,180,200,0.08)' : 'transparent',
              border:     'none',
              cursor:     'pointer',
              textAlign:  'left',
            }}
          >
            <Av user={currentUser} size={32} />
            <div>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                {currentUser.displayName || currentUser.username}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Resident</div>
            </div>
            {!inBrandMode && <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#00B4C8' }} />}
          </button>

          {/* Brand option */}
          <button
            onClick={() => { onSwitch('brand'); setOpen(false); }}
            style={{
              width:      '100%',
              padding:    '10px 14px',
              display:    'flex',
              alignItems: 'center',
              gap:        10,
              background: inBrandMode ? 'rgba(0,180,200,0.08)' : 'transparent',
              border:     'none',
              cursor:     'pointer',
              textAlign:  'left',
              borderTop:  '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {currentUser.brandLogoUrl
              ? <img src={currentUser.brandLogoUrl} alt="brand" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
              : <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,180,200,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏷️</div>
            }
            <div>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{currentUser.brandName}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Brand account</div>
            </div>
            {inBrandMode && <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#00B4C8' }} />}
          </button>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 14px', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
            One login · Two modes
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════
export default function MainApp() {
  const [tab,             setTab]             = useState('feed');
  const [viewingUsername, setViewingUsername] = useState(null);
  const { notifications, currentUser, setCurrentUser } = useApp();
  const unread   = notifications.filter(n => !n.read).length;
  const isBrand  = currentUser.accountType === 'brand' || currentUser.accountType === 'founding_brand';

  const handleOpenUserProfile = (username) => setViewingUsername(username);
  const handleCloseUserProfile = () => setViewingUsername(null);

  const handleSwitchMode = (mode) => {
    setCurrentUser(u => ({ ...u, brandMode: mode === 'brand' }));
  };

  // If viewing a user profile, show that instead of tabs
  if (viewingUsername) {
    return <UserProfileScreen username={viewingUsername} onBack={handleCloseUserProfile} />;
  }

  const inBrandMode = currentUser.brandMode === true && isBrand;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 72 }}>

      {/* ── Top header (always visible) ─────────────────────── */}
      <div style={{
        position:       'sticky',
        top:            0,
        zIndex:         100,
        background:     C.card,
        borderBottom:   `1px solid ${C.border}`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '10px 16px',
        maxWidth:       '100%',
      }}>
        {/* Left: account switcher */}
        <AccountSwitcher currentUser={currentUser} onSwitch={handleSwitchMode} />

        {/* Right: brand mode indicator or wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {inBrandMode
            ? (
              <div style={{
                background:   'rgba(0,180,200,0.12)',
                border:       '1px solid rgba(0,180,200,0.3)',
                borderRadius: 6,
                padding:      '3px 8px',
                color:        '#00B4C8',
                fontSize:     11,
                fontWeight:   700,
                letterSpacing: 0.5,
              }}>
                BRAND MODE
              </div>
            )
            : (
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
                INCYNQ
              </span>
            )
          }
        </div>
      </div>

      {/* ── Screens ─────────────────────────────────────────── */}
      {tab === 'feed'      && <FeedScreen      onGoToProfile={() => setTab('profile')} />}
      {tab === 'search'    && <SearchScreen    onOpenUserProfile={handleOpenUserProfile} />}
      {tab === 'events'    && <EventsScreen    />}
      {tab === 'advertise' && <AdvertiseScreen />}
      {tab === 'profile'   && <ProfileScreen   onOpenUserProfile={handleOpenUserProfile} />}

      {/* ── Bottom nav ──────────────────────────────────────── */}
      <div style={{
        position:    'fixed',
        bottom:      0,
        left:        '50%',
        transform:   'translateX(-50%)',
        width:       '100%',
        maxWidth:    480,
        background:  C.card,
        borderTop:   `1px solid ${C.border}`,
        display:     'flex',
        zIndex:      100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {NAV.map(n => {
          const active = tab === n.id;
          // In brand mode, highlight Advertise
          const brandHighlight = inBrandMode && n.id === 'advertise';
          return (
            <button key={n.id} onClick={() => setTab(n.id)}
              style={{ flex: 1, padding: '12px 0 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative' }}>
              <span style={{ fontSize: 20, filter: active ? 'none' : 'grayscale(1) opacity(.5)', transition: 'filter .2s' }}>{n.icon}</span>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: active ? C.sky : brandHighlight ? 'rgba(0,180,200,0.5)' : C.muted,
                transition: 'color .2s',
              }}>{n.label}</span>
              {n.id === 'feed' && unread > 0 && (
                <div style={{ position: 'absolute', top: 8, right: '28%', width: 8, height: 8, borderRadius: '50%', background: '#ff3366' }} />
              )}
              {active && (
                <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 2, borderRadius: 2, background: `linear-gradient(90deg,${C.sky},${C.lavender})` }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
