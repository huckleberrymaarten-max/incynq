import { useState } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';

import FeedScreen      from './FeedScreen';
import SearchScreen    from './SearchScreen';
import EventsScreen    from './EventsScreen';
import AdvertiseScreen from './AdvertiseScreen';
import ProfileScreen   from './ProfileScreen';
import AdminScreen     from './AdminScreen';

const NAV = [
  { id: 'feed',      icon: '🏠', label: 'Home'      },
  { id: 'search',    icon: '🔍', label: 'Search'    },
  { id: 'events',    icon: '🎉', label: 'Events'    },
  { id: 'advertise', icon: '📢', label: 'Advertise' },
  { id: 'profile',   icon: '👤', label: 'Profile'   },
];

const ADMIN_TYPES = ['admin', 'super_admin', 'moderator', 'support', 'finance', 'content_editor'];

export default function MainApp() {
  const [tab, setTab] = useState('feed');
  const [showAdmin, setShowAdmin] = useState(false);
  const { notifications, currentUser } = useApp();
  const unread = notifications.filter(n => !n.read).length;
  const isAdmin = ADMIN_TYPES.includes(currentUser?.accountType);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 72 }}>

      {tab === 'feed'      && <FeedScreen onGoToProfile={() => setTab('profile')} />}
      {tab === 'search'    && <SearchScreen />}
      {tab === 'events'    && <EventsScreen />}
      {tab === 'advertise' && <AdvertiseScreen />}
      {tab === 'profile'   && <ProfileScreen />}

      {/* Admin panel overlay */}
      {showAdmin && <AdminScreen onClose={() => setShowAdmin(false)} />}

      {/* Bottom nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, background: C.card,
        borderTop: `1px solid ${C.border}`, display: 'flex',
        zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {NAV.map(n => {
          const active = tab === n.id;
          return (
            <button key={n.id} onClick={() => setTab(n.id)}
              style={{ flex: 1, padding: '12px 0 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative' }}>
              <span style={{ fontSize: 20, filter: active ? 'none' : 'grayscale(1) opacity(.5)', transition: 'filter .2s' }}>{n.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: active ? C.sky : C.muted, transition: 'color .2s' }}>{n.label}</span>
              {active && (
                <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 2, borderRadius: 2, background: `linear-gradient(90deg,${C.sky},${C.lavender})` }} />
              )}
            </button>
          );
        })}

        {/* Admin button — only visible to admin-type accounts */}
        {isAdmin && (
          <button onClick={() => setShowAdmin(true)}
            style={{ flex: 1, padding: '12px 0 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative' }}>
            <span style={{ fontSize: 20 }}>🛡️</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#ff4466' }}>Admin</span>
          </button>
        )}
      </div>
    </div>
  );
}
