import { useState } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import { markAllNotificationsRead } from '../lib/db';

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d`;
  return new Date(dateStr).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
};

const NOTIF_CONFIG = {
  like:    { icon: '❤️', color: '#ff4466', label: 'liked your post' },
  comment: { icon: '💬', color: '#00b4c8', label: 'commented on your post' },
  follow:  { icon: '👤', color: '#00e5a0', label: 'started following you' },
  system:  { icon: '⚡', color: '#f0a500', label: '' },
};

export default function NotificationsScreen({ onClose }) {
  const { notifications, setNotifications, currentUser } = useApp();
  const [marking, setMarking] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    setMarking(true);
    try {
      await markAllNotificationsRead(currentUser.id);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.warn('Mark read failed:', e.message);
    } finally {
      setMarking(false);
    }
  };

  const getNotifText = (notif) => {
    const actor = notif.actor;
    if (!actor) return notif.text || 'New notification';
    const name = actor.show_display_name !== false && actor.display_name
      ? actor.display_name
      : actor.username || 'Someone';
    const cfg = NOTIF_CONFIG[notif.type];
    if (notif.type === 'comment' && notif.text) {
      return `${name} commented: "${notif.text.length > 60 ? notif.text.slice(0, 60) + '…' : notif.text}"`;
    }
    return `${name} ${cfg?.label || notif.text || ''}`;
  };

  // Group into Today, This Week, Earlier
  const now = Date.now();
  const DAY  = 86400000;
  const WEEK = 7 * DAY;
  const groups = [
    { label: 'Today',      items: notifications.filter(n => now - new Date(n.created_at).getTime() < DAY) },
    { label: 'This week',  items: notifications.filter(n => { const d = now - new Date(n.created_at).getTime(); return d >= DAY && d < WEEK; }) },
    { label: 'Earlier',    items: notifications.filter(n => now - new Date(n.created_at).getTime() >= WEEK) },
  ].filter(g => g.items.length > 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 800, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }} className="fadeUp">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, flexShrink: 0 }}>
        <button onClick={onClose} style={{ color: C.text, fontSize: 22, fontWeight: 300 }}>←</button>
        <div style={{ flex: 1 }}>
          <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Notifications</span>
          {unreadCount > 0 && (
            <span style={{ marginLeft: 8, fontSize: 11, background: C.sky, color: '#040f14', fontWeight: 800, padding: '2px 7px', borderRadius: 20 }}>
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={marking}
            style={{ fontSize: 12, color: C.sky, fontWeight: 700, padding: '6px 14px', borderRadius: 20, background: `${C.sky}11`, border: `1px solid ${C.sky}33` }}>
            {marking ? '⏳' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Empty state */}
      {notifications.length === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', color: C.muted }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 8 }}>All quiet here</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, textAlign: 'center' }}>
            When people like your posts, leave a comment, or follow you — it shows up here.
          </div>
        </div>
      )}

      {/* Notification list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {groups.map(group => (
          <div key={group.label}>
            <div style={{ padding: '12px 16px 6px', fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>
              {group.label.toUpperCase()}
            </div>
            {group.items.map(notif => {
              const cfg = NOTIF_CONFIG[notif.type] || NOTIF_CONFIG.system;
              const actor = notif.actor;
              const avatar = actor?.avatar_url
                || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(actor?.username || 'user')}&backgroundColor=b6e3f4`;

              return (
                <div key={notif.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 16px', borderBottom: `1px solid ${C.border}22`,
                  background: notif.read ? 'transparent' : `${cfg.color}08`,
                  transition: 'background .2s',
                }}>
                  {/* Avatar + icon badge */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {notif.type === 'system'
                      ? (
                        <div style={{ width: 44, height: 44, borderRadius: '18%', background: `${C.gold}22`, border: `2px solid ${C.gold}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⚡</div>
                      ) : (
                        <img src={avatar} alt="" style={{ width: 44, height: 44, borderRadius: '18%', objectFit: 'cover', border: `2px solid ${C.border}` }} />
                      )
                    }
                    {notif.type !== 'system' && (
                      <div style={{
                        position: 'absolute', bottom: -3, right: -3,
                        width: 20, height: 20, borderRadius: '50%',
                        background: cfg.color, border: `2px solid ${C.bg}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, lineHeight: 1,
                      }}>
                        {cfg.icon}
                      </div>
                    )}
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, lineHeight: 1.5,
                      color: notif.read ? C.sub : C.text,
                      fontWeight: notif.read ? 400 : 600,
                    }}>
                      {getNotifText(notif)}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                      {timeAgo(notif.created_at)}
                    </div>
                  </div>

                  {/* Unread dot */}
                  {!notif.read && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0, marginTop: 5 }} />
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Bottom padding */}
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
