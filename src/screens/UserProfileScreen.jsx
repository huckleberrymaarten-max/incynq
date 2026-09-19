import { useState, useEffect } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import { visibleName, gridStatusLabel } from '../data';
import Av from '../components/Av';
import { getProfileByUsername, getProfileStats, followUser, unfollowUser, createNotification, formatMemberSince, getFoundingBrandBadge, trackProfileView } from '../lib/db';
import { subscribeToPush, getPushStatus } from '../lib/pushNotifications';

export default function UserProfileScreen({ username, onBack, viewAs }) {
  const { currentUser, following, setFollowing } = useApp();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);

  // Load profile
  useEffect(() => {
    const load = async () => {
      if (!username) return;
      setLoading(true);
      try {
        const profileData = await getProfileByUsername(username);
        if (profileData) {
          setProfile(profileData);
          const statsData = await getProfileStats(profileData.id);
          setStats(statsData);

          // Analytics: track profile view for BRAND accounts only
          // Resident profiles are never tracked — privacy-first
          // (trackProfileView also auto-excludes self-views)
          if (profileData.account_type === 'brand' && currentUser?.id) {
            trackProfileView(profileData.id, currentUser.id, 'direct');
          }
        }
      } catch (e) {
        console.warn('Load profile failed:', e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [username]);

  // Asked once, after a first follow — the moment someone commits to hearing
  // from a person, which is a far better time than a toggle buried three
  // screens deep in Settings. Declining is remembered, so nobody gets nagged on
  // every follow; the Settings toggle is still there if they change their mind.
  const [askPush, setAskPush] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const maybeAskForPush = async () => {
    try {
      if (localStorage.getItem('incynq_push_asked')) return;
      const status = await getPushStatus();
      // Already on, or the browser has blocked it — either way, don't ask.
      if (status?.subscribed || status?.permission === 'denied') return;
      setAskPush(true);
    } catch { /* never block a follow on this */ }
  };

  const acceptPush = async () => {
    setPushBusy(true);
    try {
      await subscribeToPush(currentUser.id);
      localStorage.setItem('incynq_push_asked', '1');
      setAskPush(false);
    } catch (e) {
      console.warn('Push subscribe failed:', e.message);
      setAskPush(false);
    } finally { setPushBusy(false); }
  };

  const declinePush = () => {
    localStorage.setItem('incynq_push_asked', '1');
    setAskPush(false);
  };

  const handleFollow = async () => {
    if (!profile) return;
    const isFollowing = following.has(profile.id);
  const isBrandProfile = profile.account_type === 'brand' || profile.account_type === 'founding_brand';
  const showAsBrand = viewAs === 'brand' || (isBrandProfile && !profile.username.toLowerCase().includes(username?.toLowerCase()));
    const n = new Set(following);
    isFollowing ? n.delete(profile.id) : n.add(profile.id);
    setFollowing(n);
    
    try {
      if (isFollowing) {
        await unfollowUser(currentUser.id, profile.id);
      } else {
        await followUser(currentUser.id, profile.id);
        createNotification({
          userId: profile.id,
          type: 'follow',
          actorId: currentUser.id,
        });
        maybeAskForPush();
      }
    } catch (e) {
      console.warn('Follow failed:', e.message);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.muted, fontSize: 14 }}>Loading profile…</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 40 }}>👤</div>
        <div style={{ color: C.text, fontSize: 16, fontWeight: 700 }}>User not found</div>
        <button onClick={onBack} style={{ marginTop: 8, padding: '8px 16px', borderRadius: 20, background: C.card2, border: `1px solid ${C.border}`, color: C.sky, fontWeight: 700, fontSize: 13 }}>
          Go Back
        </button>
      </div>
    );
  }

  const isFollowing = following.has(profile.id);
  const isBrandProfile = profile.account_type === 'brand' || profile.account_type === 'founding_brand';
  const showAsBrand = viewAs === 'brand' || (isBrandProfile && !profile.username.toLowerCase().includes(username?.toLowerCase()));

  return (
    <div style={{ paddingBottom: 80 }}>

      {/* Asked once, right after a first follow — a clear reason at the right
          moment, rather than the pop-up every site throws at you on arrival.
          A blocked permission is much harder to undo than a deferred one. */}
      {askPush && (
        <div onClick={declinePush}
          style={{ position: 'fixed', inset: 0, background: 'rgba(4,15,20,0.88)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '22px 20px calc(24px + env(safe-area-inset-bottom))', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🔔</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: C.text, marginBottom: 6 }}>
              Want to know when they go live?
            </div>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, marginBottom: 18 }}>
              We'll let you know when someone you follow starts a set or posts something
              worth seeing. Nothing else — no daily digests, no nagging.
            </div>
            <button onClick={acceptPush} disabled={pushBusy}
              style={{ width: '100%', padding: '13px', borderRadius: 14, border: 'none', marginBottom: 8,
                background: pushBusy ? C.border : `linear-gradient(135deg,${C.sky},${C.peach})`,
                color: pushBusy ? C.muted : '#060d14', fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
              {pushBusy ? 'Just a moment…' : 'Yes, keep me posted'}
            </button>
            <button onClick={declinePush}
              style={{ width: '100%', padding: '11px', borderRadius: 14, border: 'none', background: 'transparent', color: C.muted, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Not now
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ color: C.sky, fontSize: 18 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: C.text }}>{showAsBrand && profile.brand_name ? profile.brand_name : visibleName(profile)}</div>
          <div style={{ fontSize: 12, color: C.muted }}>@{showAsBrand && profile.brand_handle ? profile.brand_handle : profile.username}</div>
        </div>
      </div>

      {/* Profile Content */}
      <div style={{ padding: '16px 20px' }}>
        {/* Avatar + Name */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ flexShrink: 0 }}>
            {showAsBrand && profile.brand_logo_url
              ? <img src={profile.brand_logo_url} alt={profile.brand_name} style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', border: `2px solid ${C.sky}44` }} />
              : <Av src={profile.avatar_url} size={72} ring={C.sky} status={profile.grid_status} />
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>{showAsBrand && profile.brand_name ? profile.brand_name : visibleName(profile)}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>@{showAsBrand && profile.brand_handle ? profile.brand_handle : profile.username}</div>
            {!showAsBrand && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {gridStatusLabel(profile.grid_status || 'online')}
              </div>
            )}

            {/* Member Since / Brand Since */}
            {profile.activated_at && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>📅</span>
                <span>{formatMemberSince(
                  profile.account_type === 'brand' ? profile.brand_joined_at || profile.created_at : profile.activated_at,
                  profile.account_type
                )}</span>
              </div>
            )}

            {/* Founding Brand Badge */}
            {profile.account_type === 'brand' && profile.founding_brand_number && (
              <div style={{ 
                marginTop: 6, 
                display: 'inline-block',
                background: `linear-gradient(135deg, ${C.gold}22, ${C.peach}22)`,
                border: `1px solid ${C.gold}44`,
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                color: C.gold
              }}>
                {getFoundingBrandBadge(profile.founding_brand_number)}
              </div>
            )}

            {/* Official Badge */}
            {profile.account_type === 'official' && (
              <div style={{ 
                marginTop: 6, 
                display: 'inline-block',
                background: `linear-gradient(135deg, ${C.gold}22, ${C.peach}22)`,
                border: `1px solid ${C.gold}44`,
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                color: C.gold
              }}>
                ⚡ Official
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, marginBottom: 16 }}>
          {showAsBrand ? (profile.brand_description || 'No description yet.') : (profile.bio || 'No bio yet.')}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}`, marginBottom: 16 }}>
          {(profile.account_type === 'official'
            ? [['Posts', stats.posts]]
            : [['Posts', stats.posts], ['Followers', stats.followers], ['Following', stats.following]]
          ).map(([label, val], i, arr) => (
            <div key={label}
              style={{ flex: 1, textAlign: 'center', padding: '12px 0', background: C.card2, borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>
                {val}
              </div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Follow Button */}
        {currentUser && profile.id !== currentUser.id && (
          <button onClick={handleFollow}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 12,
              background: isFollowing ? `${C.sky}18` : `linear-gradient(135deg,${C.sky},${C.peach})`,
              border: isFollowing ? `1px solid ${C.sky}44` : 'none',
              color: isFollowing ? C.sky : '#060d14',
              fontWeight: 700,
              fontSize: 14
            }}>
            {isFollowing ? 'Unfollow' : 'Follow'}
          </button>
        )}

        {/* Posts section would go here */}
        <div style={{ marginTop: 24, padding: '20px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
          Posts coming soon...
        </div>
      </div>
    </div>
  );
}
