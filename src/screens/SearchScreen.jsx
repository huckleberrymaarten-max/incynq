import C from '../theme';
import { useState, useEffect } from 'react';
import { visibleName } from '../data';
import { useContent } from '../context/ContentContext';
import { searchProfiles, followUser, unfollowUser, createNotification, getActiveAds } from '../lib/db';
import { useApp } from '../context/AppContext';
import { matchAdsForUser, shuffleAds } from '../lib/adMatch';

// ── Sponsored surfaces on Search / Explore ───────────────────
// Tier placement per the published design:
//   Basic   → highlighted here (this is Basic's ONLY placement)
//   Premium → explore banner here, on top of its feed placement
// Featured is feed-only and deliberately does not appear on this screen.

function PremiumBanner({ ad }) {
  const brand = ad.brand || {};
  return (
    <div style={{ margin: '10px 16px 4px', borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.gold}44`, background: C.card }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
        {brand.brand_logo_url
          ? <img src={brand.brand_logo_url} alt="" style={{ width: 34, height: 34, borderRadius: 10, objectFit: 'cover' }} />
          : <div style={{ width: 34, height: 34, borderRadius: 10, background: `${C.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🏷️</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{brand.brand_name || brand.username}</div>
          <div style={{ fontSize: 10, color: C.gold, fontWeight: 800, letterSpacing: 1 }}>SPONSORED</div>
        </div>
      </div>
      {ad.ad_image_url && (
        <img src={ad.ad_image_url} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
      )}
      {ad.ad_caption && (
        <div style={{ padding: '10px 14px', fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{ad.ad_caption}</div>
      )}
      {(ad.location_name || ad.slurl || ad.marketplace_url) && (
        <div style={{ padding: '0 14px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {ad.location_name && <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>📍 {ad.location_name}</span>}
          {ad.slurl && <a href={ad.slurl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.sky, fontWeight: 700 }}>Visit inworld →</a>}
          {ad.marketplace_url && <a href={ad.marketplace_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.sky, fontWeight: 700 }}>Marketplace →</a>}
        </div>
      )}
    </div>
  );
}

function BasicAdRow({ ad }) {
  const brand = ad.brand || {};
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: `${C.sky}08`, borderBottom: `1px solid ${C.border}22` }}>
      {ad.ad_image_url
        ? <img src={ad.ad_image_url} alt="" style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
        : brand.brand_logo_url
          ? <img src={brand.brand_logo_url} alt="" style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 46, height: 46, borderRadius: 12, background: `${C.sky}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🏷️</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{brand.brand_name || brand.username}</div>
        {ad.ad_caption && (
          <div style={{ fontSize: 12, color: C.sub, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.ad_caption}</div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: C.sky, background: `${C.sky}18`, border: `1px solid ${C.sky}33`, borderRadius: 6, padding: '1px 6px', letterSpacing: 0.5 }}>SPONSORED</span>
          {ad.location_name && <span style={{ fontSize: 11, color: C.muted }}>📍 {ad.location_name}</span>}
        </div>
      </div>
      {ad.slurl && (
        <a href={ad.slurl} target="_blank" rel="noreferrer"
          style={{ padding: '7px 14px', borderRadius: 20, flexShrink: 0, fontWeight: 700, fontSize: 12, color: C.sky, border: `1px solid ${C.sky}44` }}>
          Visit
        </a>
      )}
    </div>
  );
}

export default function SearchScreen({ onOpenUserProfile }) {
  const { following, setFollowing, currentUser, myGroups, mySubs } = useApp();
  const inBrandMode   = currentUser?.brandMode === true;
  const ownBrandId    = currentUser?.id; // brand mode: same id
  const managedIds    = (currentUser?.managedBrands || []).map(b => b.id);
  const managingId    = currentUser?.managingBrandId || null;
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState([]);
  const [searching, setSearching] = useState(false);
  const { interestGroups: INTEREST_GROUPS } = useContent();
  const q = query.toLowerCase().trim();
  const [liveAds, setLiveAds] = useState([]);

  // Sponsored placements for this screen
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getActiveAds();
        if (alive) setLiveAds(data || []);
      } catch (e) { console.warn('Could not load ads:', e.message); }
    })();
    return () => { alive = false; };
  }, []);

  const adUser = {
    groups: myGroups, subs: mySubs,
    maturity: currentUser?.maturity, adultVerified: currentUser?.adultVerified,
  };
  const matchedAds  = matchAdsForUser(liveAds, adUser);
  const premiumAd   = shuffleAds(matchedAds.filter(a => a.tier === 'premium'))[0] || null;
  const basicAds    = shuffleAds(matchedAds.filter(a => a.tier === 'basic')).slice(0, 3);

  // Search Supabase profiles
  useEffect(() => {
    if (!q) { setPeople([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchProfiles(q, currentUser?.id);
        setPeople(results || []);
      } catch(e) { console.warn('Search failed:', e.message); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const groups  = q ? INTEREST_GROUPS.filter(g => g.label.toLowerCase().includes(q)) : [];
  const tags    = q ? INTEREST_GROUPS.flatMap(g => (g.tags || []).filter(t => t.includes(q))).slice(0, 10) : [];
  const hasResults = people.length || groups.length || tags.length;

  const handleFollow = async (u) => {
    const isFollowing = following.has(u.id);
    const n = new Set(following);
    isFollowing ? n.delete(u.id) : n.add(u.id);
    setFollowing(n);
    try {
      if (isFollowing) {
        await unfollowUser(currentUser.id, u.id);
      } else {
        await followUser(currentUser.id, u.id);
        // Notify the followed user
        createNotification({
          userId:  u.id,
          type:    'follow',
          actorId: currentUser.id,
        });
      }
    } catch(e) { console.warn('Follow failed:', e.message); }
  };

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

      {/* Explore — sponsored placements show with or without a query */}
      {premiumAd && <PremiumBanner ad={premiumAd} />}

      {/* No query — empty state */}
      {!q && (
        <>
          <div style={{ textAlign: 'center', padding: premiumAd ? '30px 20px 20px' : '60px 20px 20px', color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6 }}>Search InCynq</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>Find people, brands, locations and interest groups.</div>
          </div>
          {basicAds.length > 0 && (
            <div>
              <div style={{ padding: '10px 16px 6px', fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>BASED ON YOUR INTERESTS</div>
              {basicAds.map(ad => <BasicAdRow key={`ex_${ad.id}`} ad={ad} />)}
            </div>
          )}
        </>
      )}

      {/* No results */}
      {q && !hasResults && !searching && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 6 }}>No results for "{query}"</div>
          <div style={{ fontSize: 13 }}>Try a different search term.</div>
        </div>
      )}

      {/* Searching spinner */}
      {searching && (
        <div style={{ padding: '20px 16px', fontSize: 12, color: C.muted, textAlign: 'center' }}>Searching…</div>
      )}

      {/* Results */}
      {q && hasResults && (
        <div style={{ padding: '8px 0 20px' }}>

          {/* Sponsored — Basic tier, pinned above organic results */}
          {basicAds.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {basicAds.map(ad => <BasicAdRow key={`sp_${ad.id}`} ad={ad} />)}
            </div>
          )}

          {/* People */}
          {people.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ padding: '10px 16px 6px', fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>PEOPLE</div>
              {people.flatMap(u => {
                const isBrand     = u.account_type === 'brand' || u.account_type === 'founding_brand';
                const isPerformer = u.account_type === 'performer';
                const isIdentity  = isBrand || isPerformer;  // brand-style identity row
                const lq = q.toLowerCase();

                // Does query match resident identity?
                const matchesResident = (u.username || '').toLowerCase().includes(lq) ||
                  (u.display_name || '').toLowerCase().includes(lq);

                // Does query match a brand / performer identity?
                const matchesIdentity = isIdentity && (
                  (u.brand_name || '').toLowerCase().includes(lq) ||
                  (u.brand_handle || '').toLowerCase().includes(lq)
                );

                const entries = [];
                const isSelf    = u.id === currentUser?.id;
                const isManaged = managedIds.includes(u.id);
                const isOwned   = (currentUser?.ownedBrands || []).some(b => b.id === u.id);

                // ── Resident entry visibility ──
                // A performer is a SEPARATE identity row (not a person), so it is never
                // shown as a resident. Brands live on the resident's own row, so they can
                // appear as both a resident and a brand entry.
                const showResident = !isPerformer && (!isBrand || matchesResident) && !(isSelf && !inBrandMode);

                // ── Brand / performer entry visibility ──
                const showBrand = isIdentity && matchesIdentity && !(isSelf && inBrandMode);

                if (showResident) {
                  entries.push({
                    key: `${u.id}_resident`,
                    id: u.id,
                    displayAs: 'resident',
                    name: u.show_display_name !== false && u.display_name ? u.display_name : u.username,
                    handle: u.username,
                    avatar: u.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(u.username)}&backgroundColor=b6e3f4`,
                    cynqified: u.cynqified,
                    bio: u.bio,
                    hideFollow: isSelf,
                  });
                }

                if (showBrand) {
                  entries.push({
                    key: `${u.id}_brand`,
                    id: u.id,
                    displayAs: isPerformer ? 'performer' : 'brand',
                    name: u.brand_name || u.display_name || u.username,
                    handle: u.brand_handle || u.username,
                    avatar: u.brand_logo_url || null,
                    cynqified: u.cynqified,
                    bio: null,
                    hideFollow: isSelf || isManaged || isOwned,
                  });
                }

                return entries;
              }).map(entry => {
                const isFollowing = following.has(entry.id);
                const isPerformerEntry = entry.displayAs === 'performer';
                const isBrandEntry = entry.displayAs === 'brand' || isPerformerEntry;
                return (
                  <div key={entry.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.border}22` }}>
                    <div
                      onClick={() => onOpenUserProfile && onOpenUserProfile(isBrandEntry ? `brand:${entry.handle}` : entry.handle)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                      {entry.avatar
                        ? <img src={entry.avatar} alt="" style={{ width: 46, height: 46, borderRadius: isBrandEntry ? 14 : '18%', objectFit: 'cover', border: `2px solid ${C.sky}44`, flexShrink: 0 }} />
                        : <div style={{ width: 46, height: 46, borderRadius: isBrandEntry ? 14 : '18%', background: 'rgba(0,180,200,0.12)', border: `2px solid ${C.sky}44`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{isPerformerEntry ? '🎧' : isBrandEntry ? '🏷️' : '👤'}</div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{entry.name}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>@{entry.handle}</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                          {isPerformerEntry
                            ? <span style={{ fontSize: 10, fontWeight: 700, color: C.sky, background: `${C.sky}18`, border: `1px solid ${C.sky}33`, borderRadius: 6, padding: '1px 6px' }}>🎧 Performer</span>
                            : isBrandEntry && <span style={{ fontSize: 10, fontWeight: 700, color: C.gold, background: `${C.gold}18`, border: `1px solid ${C.gold}33`, borderRadius: 6, padding: '1px 6px' }}>Brand</span>}
                          {entry.cynqified && <span style={{ fontSize: 10, fontWeight: 700, color: C.sky, background: `${C.sky}18`, border: `1px solid ${C.sky}33`, borderRadius: 6, padding: '1px 6px' }}>✅ Cynqified</span>}
                          {entry.bio && !isBrandEntry && <span style={{ fontSize: 12, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.bio}</span>}
                        </div>
                      </div>
                    </div>
                    {!entry.hideFollow && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFollow({ id: entry.id }); }}
                        style={{ padding: '7px 16px', borderRadius: 20, flexShrink: 0, fontWeight: 700, fontSize: 12,
                          background: isFollowing ? C.card2 : `linear-gradient(135deg,${C.sky},${C.peach})`,
                          color: isFollowing ? C.sky : '#060d14',
                          border: isFollowing ? `1px solid ${C.sky}44` : 'none' }}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                );
              })}
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
