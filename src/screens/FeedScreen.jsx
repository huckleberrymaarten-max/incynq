import { useState, useEffect, useRef } from 'react';

// Module-level like debounce to prevent double-fire
const likeDebounce = new Map();
import C from '../theme';
import { useApp } from '../context/AppContext';
import { userOf, locOf, adMatchesUser, visibleName, USERS } from '../data';
import Av from '../components/Av';
import HelpScreen from './HelpScreen';
import { getPosts, getLikes, likePost, unlikePost, getComments, addComment, deleteComment, updatePostLikeCount } from '../lib/db';
import ComposeScreen from '../components/ComposeScreen';
import logo from '../assets/Q_Logo_.png';

function PostCard({ post, onLike, onSave, liked, saved, currentUser, onReport, onDelete, onLikeDb, onEdit, onGoToProfile }) {
  const [reported, setReported] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments?.length || 0);
  const likingRef = useRef(false);

  const loadComments = async () => {
    if (typeof post.id === 'number') return;
    setLoadingComments(true);
    try {
      const data = await getComments(post.id);
      setComments(data);
      setCommentCount(data.length);
    } catch(e) { console.warn('Comments failed:', e.message); }
    finally { setLoadingComments(false); }
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    try {
      const newComment = await addComment(post.id, currentUser.id, commentText.trim());
      setComments(prev => [...prev, newComment]);
      setCommentCount(prev => prev + 1);
      setCommentText('');
    } catch(e) { console.warn('Comment failed:', e.message); }
  };

  const handleShowComments = () => {
    setShowComments(!showComments);
    if (!showComments && comments.length === 0) loadComments();
  };

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
        {(user.isOfficial || user.username === 'incynq')
          ? <img src={logo} alt="InCynq" style={{ width: 38, height: 38, objectFit: 'contain', filter: `drop-shadow(0 0 8px ${C.sky}88)`, flexShrink: 0 }} />
          : <Av src={user.avatar} size={38} ring={C.sky} status={user.gridStatus} />
        }
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
          ? <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowEdit(!showEdit)}
                style={{ color: C.sky, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: `${C.sky}11`, border: `1px solid ${C.sky}33` }}>
                Edit
              </button>
              <button onClick={() => onDelete(post.id)}
                style={{ color: '#ff4466', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: '#ff446611', border: '1px solid #ff446633' }}>
                Delete
              </button>
            </div>
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
            <img src={logo} alt="InCynq" style={{ width: 38, height: 38, objectFit: 'contain', flexShrink: 0, filter: `drop-shadow(0 0 8px ${C.sky}88)` }} />
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
            <span style={{ color: C.sky, fontWeight: 700, display: 'block', marginTop: 8 }}>The InCynq Team</span>
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
        <button onClick={e => {
          e.preventDefault(); e.stopPropagation();
          const key = `${post.id}_${currentUser?.id}`;
          if (likeDebounce.get(key)) return;
          likeDebounce.set(key, true);
          setTimeout(() => likeDebounce.delete(key), 1000);
          const wasLiked = liked;
          onLike(post.id);
          onLikeDb?.(post.id, wasLiked);
        }} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 20, filter: liked ? 'none' : 'grayscale(1)' }}>{liked ? '❤️' : '🤍'}</span>
          <span style={{ fontSize: 13, color: liked ? '#ff4466' : C.muted, fontWeight: 700 }}>{post.likes}</span>
        </button>
        <button onClick={handleShowComments} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 20 }}>💬</span>
          <span style={{ fontSize: 13, color: showComments ? C.sky : C.muted, fontWeight: 700 }}>{commentCount}</span>
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

      {/* Edit caption */}
      {isOwn && showEdit && (
        <div style={{ padding: '8px 14px 4px' }}>
          <textarea value={editCaption} onChange={e => setEditCaption(e.target.value)}
            style={{ width: '100%', background: C.card2, border: `1px solid ${C.sky}`, color: C.text, fontSize: 13, padding: '8px 12px', borderRadius: 10, resize: 'none', minHeight: 60, fontFamily: 'inherit', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button onClick={() => setShowEdit(false)}
              style={{ flex: 1, padding: '8px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, color: C.muted, fontWeight: 700, fontSize: 12 }}>
              Cancel
            </button>
            <button onClick={async () => {
                if (!editCaption.trim()) return;
                onEdit?.(post.id, editCaption.trim());
                setShowEdit(false);
                try {
                  const { supabase } = await import('../lib/supabase');
                  await supabase.from('posts').update({ caption: editCaption.trim() }).eq('id', post.id);
                } catch(e) { console.warn('Edit failed:', e.message); }
              }}
              style={{ flex: 1, padding: '8px', borderRadius: 10, background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 700, fontSize: 12 }}>
              Save →
            </button>
          </div>
        </div>
      )}

      {/* Comments section */}
      {showComments && (
        <div style={{ padding: '4px 14px 12px', borderTop: `1px solid ${C.border}22` }}>
          {loadingComments && <div style={{ fontSize: 12, color: C.muted, padding: '8px 0' }}>Loading…</div>}
          {comments.map(c => {
            const cUser = c.profiles;
            const cName = cUser?.show_display_name !== false && cUser?.display_name ? cUser.display_name : cUser?.username;
            return (
              <div key={c.id} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}11` }}>
                <img src={cUser?.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${cUser?.username}`} alt=""
                  style={{ width: 28, height: 28, borderRadius: '18%', objectFit: 'cover', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: C.text, marginRight: 6 }}>{cName}</span>
                  <span style={{ fontSize: 12, color: C.sub }}>{c.text}</span>
                </div>
                {c.user_id === currentUser?.id && (
                  <button onClick={async () => {
                    setComments(prev => prev.filter(x => x.id !== c.id));
                  setCommentCount(prev => Math.max(0, prev - 1));
                    try { await deleteComment(c.id); } catch(e) {}
                  }} style={{ color: C.muted, fontSize: 10 }}>✕</button>
                )}
              </div>
            );
          })}
          {typeof post.id !== 'number' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleComment()}
                placeholder="Add a comment…"
                style={{ flex: 1, background: C.card2, border: `1px solid ${C.border}`, color: C.text, fontSize: 12, padding: '7px 12px', borderRadius: 20, outline: 'none', fontFamily: 'inherit' }} />
              <button onClick={handleComment}
                style={{ padding: '7px 14px', borderRadius: 20, background: commentText.trim() ? `linear-gradient(135deg,${C.sky},${C.peach})` : C.card2, color: commentText.trim() ? '#060d14' : C.muted, fontWeight: 700, fontSize: 12 }}>
                Post
              </button>
            </div>
          )}
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
            // Keep welcome post, replace everything else with real posts
            const welcomePost = prev.find(p => p.isWelcome);
            return welcomePost ? [welcomePost, ...mapped] : mapped;
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
              onEdit={(id, newCaption) => {
                setPosts(prev => prev.map(p => p.id === id ? { ...p, caption: newCaption } : p));
              }}
              onGoToProfile={onGoToProfile}
              onLikeDb={async (id, isLiked) => {
                if (typeof id === 'number') return;
                try {
                  if (isLiked) {
                    await unlikePost(id, currentUser.id);
                    } else {
                    await likePost(id, currentUser.id);
                    }
                  const newCount = await updatePostLikeCount(id);
                  setPosts(prev => prev.map(p => p.id === id ? { ...p, likes: newCount } : p));
                } catch(e) { console.warn('Like failed:', e.message); }
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
