import { useState } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import { userOf, locOf, adMatchesUser, visibleName, USERS } from '../data';
import Av from '../components/Av';

function PostCard({ post, onLike, onSave, liked, saved, currentUser, onReport }) {
  const [reported, setReported] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const user = userOf(post.userId, USERS);
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
        <button onClick={() => setShowReport(true)} style={{ color: C.muted, fontSize: 14, opacity: .6 }}>🚩</button>
      </div>

      {/* Under review */}
      {reported && (
        <div style={{ margin: '0 14px 8px', padding: '8px 12px', background: '#ff8c0011', border: '1px solid #ff8c0033', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>🔍</span>
          <div style={{ fontSize: 12, color: '#ff8c00' }}>Under review — our team will check this.</div>
        </div>
      )}

      {/* Welcome post card */}
      {post.isWelcome && (
        <div style={{ margin: '0 14px 8px', padding: '18px 16px', background: `linear-gradient(135deg,${C.sky}18,${C.peach}11)`, border: `1px solid ${C.sky}33`, borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 14, color: C.text, lineHeight: 1.7 }}>{post.caption}</div>
        </div>
      )}

      {/* Image */}
      {!post.isWelcome && post.image && (
        <img src={post.image} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
      )}

      {/* Actions */}
      <div style={{ padding: '10px 14px 4px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <button onClick={() => onLike(post.id)} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 20, filter: liked ? 'none' : 'grayscale(1)' }}>{liked ? '❤️' : '🤍'}</span>
          <span style={{ fontSize: 13, color: liked ? '#ff4466' : C.muted, fontWeight: 700 }}>{post.likes + (liked ? 1 : 0)}</span>
        </button>
        <button style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 20 }}>💬</span>
          <span style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>{post.comments?.length || 0}</span>
        </button>
        <button onClick={() => onSave(post.id)} style={{ marginLeft: 'auto' }}>
          <span style={{ fontSize: 20 }}>{saved ? '🔖' : '🔖'}</span>
        </button>
      </div>

      {/* Caption */}
      {!post.isWelcome && post.caption && (
        <div style={{ padding: '2px 14px 8px', fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
          <span style={{ fontWeight: 800, color: C.text, marginRight: 6 }}>{visibleName(user)}</span>
          {post.caption}
        </div>
      )}

      {/* Report modal */}
      {showReport && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000bb', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: C.card, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 20 }} className="fadeUp">
            <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 6 }}>Report this post</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>Completely anonymous.</div>
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

export default function FeedScreen() {
  const { posts, ads, liked, toggleLike, saved, toggleSave, myGroups, mySubs, currentUser, setReportQueue } = useApp();
  const activeAds = ads.filter(a => a.expiresAt > Date.now());

  const feed = (() => {
    const result = [];
    const sponsAds = activeAds.filter(a => a.tier === 'premium' || a.tier === 'featured');
    let qi = 0;
    const feedPosts = posts.filter(p => p.userId !== currentUser.id);
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
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="sg" style={{ fontWeight: 900, fontSize: 20, background: `linear-gradient(135deg,${C.sky},${C.peach})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>InCynq</span>
        <div style={{ display: 'flex', gap: 14 }}>
          <button style={{ fontSize: 20 }}>🔍</button>
          <button style={{ fontSize: 20 }}>🔔</button>
          <button style={{ fontSize: 20 }}>💬</button>
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
            />
          );
        })}
      </div>
    </div>
  );
}
