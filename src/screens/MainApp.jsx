import { useState } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';

// Tab screens
import FeedScreen      from './FeedScreen';
import DiscoverScreen  from './DiscoverScreen';
import EventsScreen    from './EventsScreen';
import AdvertiseScreen from './AdvertiseScreen';
import ProfileScreen   from './ProfileScreen';

const NAV = [
  { id: 'feed',      icon: '🏠', label: 'Home'      },
  { id: 'discover',  icon: '🔍', label: 'Discover'  },
  { id: 'events',    icon: '🎉', label: 'Events'    },
  { id: 'advertise', icon: '📢', label: 'Advertise' },
  { id: 'profile',   icon: '👤', label: 'Profile'   },
];

export default function MainApp() {
  const [tab, setTab] = useState('feed');
  const { notifications } = useApp();
  const unread = notifications.filter(n => !n.read).length;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 72 }}>

      {/* Screen content */}
      {tab === 'feed'      && <FeedScreen />}
      {tab === 'discover'  && <DiscoverScreen />}
      {tab === 'events'    && <EventsScreen />}
      {tab === 'advertise' && <AdvertiseScreen />}
      {tab === 'profile'   && <ProfileScreen />}

      {/* Bottom navigation */}
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
              <span style={{ fontSize: 20, filter: active ? 'none' : 'grayscale(1) opacity(.5)', transition: 'filter .2s' }}>
                {n.icon}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: active ? C.sky : C.muted, transition: 'color .2s' }}>
                {n.label}
              </span>
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
