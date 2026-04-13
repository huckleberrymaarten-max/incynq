import { useState } from 'react';
import C from '../theme';
import { USERS, INTEREST_GROUPS, visibleName, gridStatusColor } from '../data';
import Av from '../components/Av';
import { useApp } from '../context/AppContext';

export default function DiscoverScreen() {
  const { following, setFollowing, currentUser } = useApp();
  const [selGroup, setSelGroup] = useState(null);
  const [query, setQuery] = useState('');

  const toggle = id => {
    if (id === 0) return; // can't unfollow InCynq
    const n = new Set(following);
    n.has(id) ? n.delete(id) : n.add(id);
    setFollowing(n);
  };

  const members = USERS.filter(u =>
    u.id !== 0 && // exclude InCynq official
    u.id !== currentUser.id && // exclude self
    (!selGroup || u.groups?.includes(selGroup)) &&
    (!query || u.username.toLowerCase().includes(query.toLowerCase()) || visibleName(u).toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 50 }}>
        <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Discover</span>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.card }}>
        <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
          <span style={{ color: C.muted, fontSize: 16 }}>🔍</span>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search members…"
            style={{ background: 'transparent', border: 'none', color: C.text, fontSize: 14, flex: 1, outline: 'none' }} />
          {query && <button onClick={() => setQuery('')} style={{ color: C.muted, fontSize: 14 }}>✕</button>}
        </div>
      </div>

      {/* Interest group filter */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 7, overflowX: 'auto' }}>
        <button onClick={() => setSelGroup(null)}
          style={{ flexShrink: 0, fontSize: 11, padding: '5px 13px', borderRadius: 20, fontWeight: 700,
            border: `1px solid ${!selGroup ? C.sky : C.border}`,
            background: !selGroup ? `${C.sky}22` : 'transparent',
            color: !selGroup ? C.sky : C.muted }}>
          All
        </button>
        {INTEREST_GROUPS.map(g => (
          <button key={g.id} onClick={() => setSelGroup(selGroup === g.id ? null : g.id)}
            style={{ flexShrink: 0, fontSize: 11, padding: '5px 13px', borderRadius: 20, fontWeight: 700,
              border: `1px solid ${selGroup === g.id ? g.color : C.border}`,
              background: selGroup === g.id ? `${g.color}22` : 'transparent',
              color: selGroup === g.id ? g.color : C.muted }}>
            {g.label}
          </button>
        ))}
      </div>

      {/* InCynq official — always at top */}
      {!query && !selGroup && (
        <div style={{ padding: '10px 16px 0' }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>OFFICIAL</div>
          {(() => {
            const u = USERS.find(u => u.id === 0);
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: `${C.gold}0a`, borderRadius: 14, border: `1px solid ${C.gold}33`, marginBottom: 16 }}>
                <Av src={u.avatar} size={46} ring={C.gold} status="online" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{visibleName(u)}</span>
                    <span style={{ fontSize: 10, background: `${C.gold}22`, color: C.gold, border: `1px solid ${C.gold}44`, padding: '1px 6px', borderRadius: 20, fontWeight: 700 }}>⚡</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{u.bio}</div>
                </div>
                <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, padding: '5px 12px', background: `${C.gold}18`, borderRadius: 20, border: `1px solid ${C.gold}44` }}>
                  ✓ Following
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Members list */}
      <div style={{ padding: '10px 16px' }}>
        {!query && !selGroup && (
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>MEMBERS</div>
        )}
        {members.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 6 }}>No members found</div>
          </div>
        )}
        {members.map(u => {
          const isFollowing = following.has(u.id);
          const statusColor = gridStatusColor(u.gridStatus);
          // Shared groups with current user
          const mutuals = (u.groups || []).filter(g => currentUser.groups?.includes(g));
          return (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}22` }}>
              <Av src={u.avatar} size={46} ring={isFollowing ? C.sky : C.border} status={u.gridStatus} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{visibleName(u)}</span>
                  {u.cynqified && <span style={{ fontSize: 10, background: `${C.gold}22`, color: C.gold, border: `1px solid ${C.gold}44`, padding: '1px 6px', borderRadius: 20, fontWeight: 700 }}>⚡</span>}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>@{u.username}</div>
                {mutuals.length > 0 && (
                  <div style={{ fontSize: 10, color: C.sky, marginTop: 3 }}>
                    {mutuals.length} shared interest{mutuals.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <button onClick={() => toggle(u.id)}
                style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 20, fontWeight: 700, fontSize: 12,
                  background: isFollowing ? `${C.sky}18` : `linear-gradient(135deg,${C.sky},${C.peach})`,
                  border: isFollowing ? `1px solid ${C.sky}44` : 'none',
                  color: isFollowing ? C.sky : '#060d14', transition: 'all .2s' }}>
                {isFollowing ? '✓ Following' : 'Follow'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
