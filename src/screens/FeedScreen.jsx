import { useState, useEffect } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import { userOf, locOf, adMatchesUser, visibleName, USERS } from '../data';
import Av from '../components/Av';
import HelpScreen from './HelpScreen';
import { getPosts, getLikes, likePost, unlikePost } from '../lib/db';
import ComposeScreen from '../components/ComposeScreen';
import logo from '../assets/Q_Logo_.png';

function PostCard({ post, onLike, onSave, liked, saved, currentUser, onReport, onDelete, onLikeDb }) {
  const [reported, setReported] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const isOwn = post.userId === currentUser?.id;
  const user = isOwn
    ? currentUser
    : post._profile
      ? {
          username: post._profile.username,
          displayName: post._profile.display_name,
          showDisplayName: post._profile.show_display_name,
          avatar: post._profile.avatar_url,
        }
      : userOf(post.userId, USERS);
  const reasons = [
    '🌍 Out of This World — real life content',
    '🔞 Adult content shown to non-adults',
    '💬 Harassment or bullying',
    '🗣️ Hate speech or discrimination',
    '🚫 Spam or scam',
    '❌ Impersonation',
    '⚠️ Other',
  ];

  return (
    <div style={{ borderBottom: `1px solid ${C.border}22`, paddingBottom: 8, marginBottom: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 8px' }}>
        <Av src={user.avatar} size={38} ring={C.sky} status={user.gridStatus} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: C.text }}>{visibleName(user)}</span>
            {user.isOfficial && <span style={{ fontSize: 10, background: `${C.gold}22`, color: C.gold, border: `1px solid ${C.gold}44`, padding: '1px 6px', borderRadius: 20, fontWeight: 700 }}>⚡</span>}
          </div>
          {user.showDisplayName !== false && user.displayName && user.displayName !== user.username && (
            <div style={{ fontSize: 10, color: C.muted }}>@{user.username}</div>
          )}
          <div style={{ fontSize: 11, color: C.muted }}>{post.time}</div>
        </div>
        {isOwn
          ? <button onClick={() => onDelete(post.id)}
              style={{ color: '#ff4466', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: '#ff446611', border: '1px solid #ff446633' }}>
              Delete
            </button>
          : <button onClick={() => setShowReport(true)} style={{ color: C.muted, fontSize: 14, opacity: .6 }}>🚩</button>
        }
      </div>

      {/* Under review */}
      {reported && (
        <div style={{ margin: '0 14px 8px', padding: '8px 12px', background: '#ff8c0011', border: '1px solid #ff8c0033', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>🔍</span>
          <div style={{ fontSize: 12, color: '#ff8c00' }}>Under review — our team will check this.</div>
        </div>
      )}

      {/* Welcome post */}
      {post.isWelcome && (
        <div style={{ margin: '0 14px 8px', padding: '22px 20px', background: `linear-gradient(135deg,${C.sky}18,${C.peach}11)`, border: `1px solid ${C.sky}44`, borderRadius: 16 }}>
          {/* Logo + badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg,${C.sky},${C.peach})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>⚡</div>
            <div>
              <div className="sg" style={{ fontWeight: 800, fontSize: 14, color: C.sky }}>InCynq</div>
              <div style={{ fontSize: 11, color: C.muted }}>Just for you</div>
            </div>
          </div>
          {/* Message */}
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 10, lineHeight: 1.4 }}>
            Hey {visibleName(currentUser) || 'there'} 👋 &nbsp;You're in. ⚡
          </div>
          <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.8 }}>
            The grid just got a lot less noisy.<br /><br />
            Pick your interests in your profile and your feed will start making sense immediately.<br /><br />
            Good to have you here.<br />
            <span style={{ color: C.sky, fontWeight: 700 }}>— InCynq</span>
          </div>
          {/* CTA */}
          <button onClick={onGoToProfile} style={{ marginTop: 16, width: '100%', padding: '10px 14px', background: `${C.sky}18`, borderRadius: 10, fontSize: 12, color: C.sky, fontWeight: 700, textAlign: 'center', border: `1px solid ${C.sky}33`, cursor: 'pointer' }}>
            👤 Go to Profile → add your interests
          </button>
        </div>
      )}

      {/* Image */}
      {!post.isWelcome && post.image && (
        <img src={post.image} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
      )}

      {/* Actions */}
      <div style={{ padding: '10px 14px 4px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <button onClick={() => { onLike(post.id); onLikeDb?.(post.id, liked); }} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 20, filter: liked ? 'none' : 'grayscale(1)' }}>{liked ? '❤️' : '🤍'}</span>
          <span style={{ fontSize: 13, color: liked ? '#ff4466' : C.muted, fontWeight: 700 }}>{post.likes + (liked ? 1 : 0)}</span>
        </button>
        <button style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 20 }}>💬</span>
          <span style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>{post.comments?.length || 0}</span>
        </button>
        <button onClick={() => onSave(post.id)} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32 }}>
          <svg width="14" height="18" viewBox="0 0 18 22" fill={saved ? '#00e5a0' : '#ff4466'}>
            <path d="M1 1h16v20l-8-5-8 5V1z" stroke={saved ? '#00e5a0' : '#ff4466'} strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Caption */}
      {!post.isWelcome && post.caption && (
        <div style={{ padding: '2px 14px 8px', fontSize: 13, color: C.sub, lineHeight: 1.5, fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif' }}>
          <span style={{ fontWeight: 800, color: C.text, marginRight: 6, fontFamily: 'inherit' }}>{visibleName(user)}</span>
          {post.caption}
        </div>
      )}

      {/* Report modal */}
      {showReport && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000bb', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: C.card, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 20 }} className="fadeUp">
            <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 6 }}>Report this post</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Completely anonymous.</div>
            {reasons.map(reason => (
              <button key={reason} onClick={() => { setShowReport(false); setReported(true); if (onReport) onReport({ postId: post.id, reason }); }}
                style={{ width: '100%', padding: '11px 13px', borderRadius: 11, background: C.card2, border: `1px solid ${C.border}`, color: C.sub, fontSize: 12, fontWeight: 600, textAlign: 'left', marginBottom: 6, display: 'block' }}>
                {reason}
              </button>
            ))}
            <button onClick={() => setShowReport(false)} style={{ width: '100%', padding: 10, color: C.muted, fontWeight: 600, marginTop: 4 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FeedScreen({ onGoToProfile }) {
  const [showHelp, setShowHelp] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    const loadPosts = async () => {
      try {
        // Load likes from Supabase
        if (currentUser?.id) {
          try {
            const likedSet = await getLikes(currentUser.id);
            setLiked(likedSet);
          } catch(e) {
            console.warn('Could not load likes:', e.message);
          }
        }

        const dbPosts = await getPosts();
        if (dbPosts?.length) {
          const mapped = dbPosts.map(p => ({
            id: p.id,
            userId: p.user_id,
            image: p.image_url,
            caption: p.caption,
            tags: p.tags || [],
            likes: p.likes || 0,
            comments: [],
            time: new Date(p.created_at).toLocaleDateString(),
            locationId: p.location_id,
            _profile: p.profiles,
          }));
          setPosts(prev => {
            // Keep sample posts, add real ones at top
            const samplePosts = prev.filter(p => typeof p.id === 'number' && p.id < 100);
            return [...mapped, ...samplePosts];
          });
        }
      } catch (e) {
        console.warn('Could not load posts from Supabase:', e.message);
      } finally {
        setLoadingPosts(false);
      }
    };
    loadPosts();
  }, []);
  const { posts, setPosts, ads, liked, setLiked, toggleLike, saved, toggleSave, myGroups, mySubs, currentUser, setReportQueue } = useApp();
  const activeAds = ads.filter(a => a.expiresAt > Date.now());

  const feed = (() => {
    const result = [];

    // Show welcome post at TOP if account is less than 24 hours old
    const accountAge = currentUser.createdAt ? Date.now() - new Date(currentUser.createdAt).getTime() : 0;
    const isNewUser = !currentUser.createdAt || accountAge < 86400000;
    const welcomePost = posts.find(p => p.isWelcome);
    if (isNewUser && welcomePost) {
      result.push({ type: 'post', data: welcomePost });
    }

    const sponsAds = activeAds.filter(a => a.tier === 'premium' || a.tier === 'featured');
    let qi = 0;
    const feedPosts = posts.filter(p => !p.isWelcome);
    feedPosts.forEach((p, i) => {
      result.push({ type: 'post', data: p });
      if ((i === 1 || (i > 1 && (i + 1) % 3 === 0)) && qi < sponsAds.length) {
        const ad = sponsAds[qi++];
        const loc = locOf(ad.locationId);
        const matches = adMatchesUser(ad, { groups: myGroups, subs: mySubs, maturity: currentUser.maturity });
        if (loc) result.push({ type: 'sponsored', data: { ad, loc, matches } });
      }
    });
    return result;
  })();

  return (
    <div>
      {/* Overlays */}
      {showHelp && <HelpScreen onClose={() => setShowHelp(false)} />}
      {showCompose && <ComposeScreen onClose={() => setShowCompose(false)} />}

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={logo} alt="InCynq" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <span className="sg" style={{ fontWeight: 900, fontSize: 20, background: `linear-gradient(135deg,${C.sky},${C.peach})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>InCynq</span>
        </div>
        {/* Right icons */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <button onClick={() => setShowCompose(true)} style={{ width: 28, height: 28, borderRadius: '50%', background: `${C.sky}22`, border: `1.5px solid ${C.sky}66`, color: C.sky, fontWeight: 900, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, paddingBottom: 1 }}>+</button>
          <button style={{ fontSize: 20 }}>🔍</button>
          <button style={{ fontSize: 20 }}>🔔</button>
          <button style={{ fontSize: 20 }}>💬</button>
          <button
            onClick={() => setShowHelp(true)}
            style={{ width: 28, height: 28, borderRadius: '50%', background: `${C.sky}22`, border: `1.5px solid ${C.sky}66`, color: C.sky, fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >?</button>
        </div>
      </div>

      {/* Feed */}
      <div style={{ paddingBottom: 80 }}>
        {feed.map((item, idx) => {
          if (item.type === 'sponsored') {
            const { ad, loc, matches } = item.data;
            return (
              <div key={`sp_${ad.id}`}>
                {matches && myGroups.length > 0 && (
                  <div style={{ padding: '4px 14px', background: `${C.sky}11`, fontSize: 11, color: C.sky, fontWeight: 700 }}>🎯 Based on your interests</div>
                )}
                <PostCard
                  post={{ id: `sp_${ad.id}`, userId: USERS.find(u => u.username === loc.owner)?.id || 4, image: loc.image, caption: `✨ ${loc.desc}`, tags: loc.tags || [], likes: Math.floor(loc.visits / 30), comments: [], time: 'ad', locationId: loc.id, isSponsored: true }}
                  onLike={toggleLike} onSave={toggleSave}
                  liked={liked.has(`sp_${ad.id}`)} saved={saved.has(`sp_${ad.id}`)}
                  currentUser={currentUser}
                />
              </div>
            );
          }
          const p = item.data;
          return (
            <PostCard key={p.id} post={p}
              onLike={toggleLike} onSave={toggleSave}
              liked={liked.has(p.id)} saved={saved.has(p.id)}
              currentUser={currentUser}
              onReport={r => setReportQueue(prev => [...prev, { ...r, id: Date.now() }])}
              onDelete={async id => {
                setPosts(prev => prev.filter(p => p.id !== id));
                try {
                  const { supabase } = await import('../lib/supabase');
                  await supabase.from('posts').delete().eq('id', id);
                } catch(e) { console.warn('Delete failed:', e.message); }
              }}
              onLikeDb={async (id, isLiked) => {
                // Only save to Supabase for real posts (UUID, not sample numeric IDs)
                if (typeof id === 'number') return;
                try {
                  if (isLiked) {
                    await unlikePost(id, currentUser.id);
                  } else {
                    await likePost(id, currentUser.id);
                  }
                } catch(e) { console.warn('Like failed:', e.message); }
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
