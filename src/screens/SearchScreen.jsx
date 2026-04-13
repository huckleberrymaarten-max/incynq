import { useState } from 'react';
import C from '../theme';
import { USERS, LOCS, INTEREST_GROUPS, visibleName } from '../data';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const q = query.toLowerCase().trim();

  const people  = q ? USERS.filter(u => u.id !== 0 && (u.username.includes(q) || visibleName(u).toLowerCase().includes(q))) : [];
  const brands  = q ? LOCS.filter(l => l.name.toLowerCase().includes(q) || l.owner.includes(q)) : [];
  const locs    = q ? LOCS.filter(l => l.name.toLowerCase().includes(q)) : [];
  const groups  = q ? INTEREST_GROUPS.filter(g => g.label.toLowerCase().includes(q)) : [];
  const tags    = q ? ['#fashion','#cyberpunk','#events','#breedables','#building','#gacha','#dj','#roleplay','#photography','#newreleases'].filter(t => t.includes(q)) : [];

  const hasResults = people.length || brands.length || groups.length || tags.length;

  const filters = ['all','people','brands','locations','groups','tags'];

  return (
    <div style={{ paddingBottom: 80 }}>

      {/* Search bar */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
          <span style={{ color: C.muted, fontSize: 16 }}>🔍</span>
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search people, brands, locations, groups…"
            style={{ background: 'transparent', border: 'none', color: C.text, fontSize: 14, flex: 1, outline: 'none', fontFamily: 'inherit' }}
            autoFocus
          />
          {query && <button onClick={() => setQuery('')} style={{ color: C.muted, fontSize: 14 }}>✕</button>}
        </div>

        {/* Filter chips — only when searching */}
        {q && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ flexShrink: 0, fontSize: 11, padding: '5px 12px', borderRadius: 20, fontWeight: 700,
                  border: `1px solid ${filter === f ? C.sky : C.border}`,
                  background: filter === f ? `${C.sky}22` : 'transparent',
                  color: filter === f ? C.sky : C.muted, textTransform: 'capitalize' }}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty state — show trending */}
      {!q && (
        <div style={{ padding: 16 }}>
          <div className="sg" style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>🔥 TRENDING TAGS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 24 }}>
            {['#fashion','#cyberpunk','#events','#breedables','#building','#gacha','#dj','#roleplay','#photography','#newreleases'].map(tag => {
              const grp = INTEREST_GROUPS.find(g => g.label.toLowerCase().includes(tag.replace('#','')));
              return (
                <button key={tag} onClick={() => setQuery(tag)}
                  style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20, fontWeight: 700,
                    background: `${grp?.color || C.sky}18`, color: grp?.color || C.sky,
                    border: `1px solid ${grp?.color || C.sky}33` }}>
                  {tag}
                </button>
              );
            })}
          </div>

          <div className="sg" style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>📍 POPULAR LOCATIONS</div>
          {LOCS.slice(0, 4).map(l => (
            <div key={l.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}22`, cursor: 'pointer' }}>
              <img src={l.image} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{l.name}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>⭐ {l.rating} · {(l.visits/1000).toFixed(1)}k visits</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>@{l.owner}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {q && !hasResults && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 6 }}>No results for "{query}"</div>
          <div style={{ fontSize: 13 }}>Try a different search term.</div>
        </div>
      )}

      {/* Results */}
      {q && hasResults && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* People */}
          {(filter === 'all' || filter === 'people') && people.length > 0 && (
            <div>
              <div className="sg" style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>👤 PEOPLE</div>
              {people.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px solid ${C.border}22` }}>
                  <img src={u.avatar} alt="" style={{ width: 42, height: 42, borderRadius: '18%', objectFit: 'cover', border: `2px solid ${C.sky}44`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{visibleName(u)}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>@{u.username}</div>
                  </div>
                  <button style={{ padding: '6px 14px', borderRadius: 20, background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 700, fontSize: 11 }}>Follow</button>
                </div>
              ))}
            </div>
          )}

          {/* Brands / Locations */}
          {(filter === 'all' || filter === 'brands' || filter === 'locations') && brands.length > 0 && (
            <div>
              <div className="sg" style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>🏢 BRANDS & LOCATIONS</div>
              {brands.map(l => (
                <div key={l.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: `1px solid ${C.border}22`, alignItems: 'center' }}>
                  <img src={l.image} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{l.name}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>⭐ {l.rating} · {(l.visits/1000).toFixed(1)}k visits</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Interest groups */}
          {(filter === 'all' || filter === 'groups') && groups.length > 0 && (
            <div>
              <div className="sg" style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>🎯 INTEREST GROUPS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {groups.map(g => (
                  <div key={g.id} style={{ padding: '7px 14px', borderRadius: 20, fontWeight: 700, fontSize: 12, border: `1.5px solid ${g.color}`, background: `${g.color}18`, color: g.color }}>
                    {g.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {(filter === 'all' || filter === 'tags') && tags.length > 0 && (
            <div>
              <div className="sg" style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}># TAGS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {tags.map(t => (
                  <div key={t} style={{ padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 12, border: `1px solid ${C.sky}44`, background: `${C.sky}18`, color: C.sky }}>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
