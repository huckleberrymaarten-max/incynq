import { useState } from 'react';
import C from '../theme';
import { USERS, LOCS, visibleName } from '../data';
import { useContent } from '../context/ContentContext';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const { interestGroups: INTEREST_GROUPS } = useContent();
  const q = query.toLowerCase().trim();

  const people  = q ? USERS.filter(u => u.id !== 0 && (u.username.toLowerCase().includes(q) || visibleName(u).toLowerCase().includes(q))) : [];
  const brands  = q ? LOCS.filter(l => l.name.toLowerCase().includes(q) || l.owner.toLowerCase().includes(q)) : [];
  const groups  = q ? INTEREST_GROUPS.filter(g => g.label.toLowerCase().includes(q)) : [];
  const tags    = q ? INTEREST_GROUPS.flatMap(g => (g.tags || []).filter(t => t.includes(q))).slice(0, 10) : [];
  const hasResults = people.length || brands.length || groups.length || tags.length;

  return (
    <div style={{ paddingBottom: 80 }}>

      {/* Search bar */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
          <span style={{ color: C.muted, fontSize: 16 }}>🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search people, brands, locations, groups…"
            style={{ background: 'transparent', border: 'none', color: C.text, fontSize: 14, flex: 1, outline: 'none', fontFamily: 'inherit' }}
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: C.muted, fontSize: 14 }}>✕</button>
          )}
        </div>
      </div>

      {/* No query — empty state */}
      {!q && (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6 }}>Search InCynq</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>Find people, brands, locations and interest groups.</div>
        </div>
      )}

      {/* No results */}
      {q && !hasResults && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 6 }}>No results for "{query}"</div>
          <div style={{ fontSize: 13 }}>Try a different search term.</div>
        </div>
      )}

      {/* Results */}
      {q && hasResults && (
        <div style={{ padding: '8px 0 20px' }}>

          {/* People */}
          {people.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ padding: '10px 16px 6px', fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>PEOPLE</div>
              {people.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.border}22` }}>
                  <img src={u.avatar} alt="" style={{ width: 46, height: 46, borderRadius: '18%', objectFit: 'cover', border: `2px solid ${C.sky}44`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{visibleName(u)}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>@{u.username}</div>
                    {u.bio && <div style={{ fontSize: 12, color: C.sub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.bio}</div>}
                  </div>
                  <button style={{ padding: '7px 16px', borderRadius: 20, background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                    Follow
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Brands & Locations */}
          {brands.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ padding: '10px 16px 6px', fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>BRANDS & LOCATIONS</div>
              {brands.map(l => (
                <div key={l.id} style={{ display: 'flex', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.border}22`, alignItems: 'center' }}>
                  <img src={l.image} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{l.name}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>@{l.owner}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>⭐ {l.rating} · {(l.visits/1000).toFixed(1)}k visits</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Interest Groups */}
          {groups.length > 0 && (
            <div>
              <div style={{ padding: '10px 16px 6px', fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>INTEREST GROUPS</div>
              {groups.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${C.border}22` }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${g.color}22`, border: `1.5px solid ${g.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 24, lineHeight: 1 }}>{g.icon}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: g.color }}>{g.label.replace(/^\S+\s/, '')}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(g.subs || []).slice(0, 3).join(', ')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
