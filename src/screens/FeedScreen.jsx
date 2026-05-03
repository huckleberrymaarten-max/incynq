import { useState, useEffect, useRef } from 'react';

// Module-level like debounce to prevent double-fire
const likeDebounce = new Map();
import C from '../theme';
import { useApp } from '../context/AppContext';
import { userOf, locOf, visibleName, USERS } from '../data';

// ── adMatchesUser — maturity filter ──────────────────────────
// LOCKED MODEL:
//   General  → sees General only
//   Moderate → sees General + Moderate
//   Adult    → sees General + Moderate + Adult (requires adult_verified)
//
// user sees ad IF ad maturity level ≤ user's highest enabled level
const MATURITY_RANK = { general: 0, moderate: 1, adult: 2 };

const adMatchesUser = (ad, user) => {
  // Parse maturity — handle both array and JSON string from Supabase
  let maturityArr = user.maturity;
  if (typeof maturityArr === 'string') {
    try { maturityArr = JSON.parse(maturityArr); } catch { maturityArr = [maturityArr]; }
  }
  if (!Array.isArray(maturityArr)) maturityArr = ['general'];

  const adLevel = ad.adMaturity || 'general';

  // Adult ads require adult_verified
  if (adLevel === 'adult' && !user.adultVerified) return false;

  // Get user's highest enabled maturity rank
  const ranks = maturityArr.map(m => MATURITY_RANK[m] ?? 0);
  const userMaxRank = ranks.length > 0 ? Math.max(...ranks) : 0;
  const adRank = MATURITY_RANK[adLevel] ?? 0;

  // Ad level must be ≤ user's max level
  if (adRank > userMaxRank) return false;

  // Interest group matching
  if (ad.isRandom) return true;
  if (!ad.groups || ad.groups.length === 0) return true;
  const userGroups = new Set([...(user.groups || []), ...(user.subs || [])]);
  return ad.groups.some(g => userGroups.has(g));
};
import Av from '../components/Av';
import HelpScreen from './HelpScreen';
import NotificationsScreen from './NotificationsScreen';
import { getPosts, getLikes, likePost, unlikePost, getComments, addComment, deleteComment, updatePostLikeCount, createNotification, trackImpressionsBatch, trackPostView, getActiveAds } from '../lib/db';
import ComposeScreen from '../components/ComposeScreen';
import logo from '../assets/Q_Logo_.png';

// ── AdCard — renders a real Supabase ad in the feed ─────────
function AdCard({ ad }) {
  const brand = ad.brand || {};
  const brandName = brand.brand_name || brand.username || 'Sponsored';
  const brandLogo = brand.brand_logo_url;

  return (
    <div style={{ background: 'var(--c-card, #0d1f2d)', borderRadius: 16, overflow: 'hidden', marginBottom: 2, border: '1px solid rgba(0,180,200,0.2)' }}>
      {/* Sponsored header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {brandLogo
          ? <img src={brandLogo} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(0,180,200,0.3)' }} />
          : <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,180,200,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏷️</div>
        }
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#fff' }}>{brandName}</div>
          <div style={{ fontSize: 10, color: 'rgba(0,180,200,0.8)', fontWeight: 700, letterSpacing: 0.5 }}>SPONSORED</div>
        </div>
      </div>

      {/* Ad image */}
      {ad.ad_image_url && (
        <img src={ad.ad_image_url} alt="Ad" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
      )}

      {/* Caption */}
      {ad.ad_caption && (
        <div style={{ padding: '12px 14px', fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
          {ad.ad_caption}
        </div>
      )}

      {/* Location + links */}
      {(ad.location_name || ad.slurl || ad.marketplace_url) && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ad.location_name && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>📍 {ad.location_name}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ad.slurl && (
              <a href={ad.slurl} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: '#00B4C8', fontWeight: 700, padding: '6px 14px', borderRadius: 20, background: 'rgba(0,180,200,0.12)', border: '1px solid rgba(0,180,200,0.3)', textDecoration: 'none' }}>
                🌐 Visit in SL
              </a>
            )}
            {ad.marketplace_url && (
              <a href={ad.marketplace_url} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: '#F4B942', fontWeight: 700, padding: '6px 14px', borderRadius: 20, background: 'rgba(244,185,66,0.12)', border: '1px solid rgba(244,185,66,0.3)', textDecoration: 'none' }}>
                🛍 Marketplace
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({ post, onLike, onSave, liked, saved, currentUser, onReport, onDelete, onLikeDb, onEdit, onGoToProfile }) {
  const [reported, setReported] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments?.length || 0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const likingRef = useRef(false);

  // Get images array (support both single and multiple images)
  const images = post.images && post.images.length > 0 
    ? post.images 
    : post.image 
    ? [post.image] 
    : [];

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
    const text = commentText.trim();
    try {
      const newComment = await addComment(post.id, currentUser.id, text);
      setComments(prev => [...prev, newComment]);
      setCommentCount(prev => prev + 1);
      setCommentText('');
      // Notify post owner (skip if own post)
      if (post.userId && post.userId !== currentUser?.id) {
        createNotification({
          userId:  post.userId,
          type:    'comment',
          actorId: currentUser.id,
          postId:  post.id,
          text:    text.slice(0, 100),
        });
      }
    } catch(e) { console.warn('Comment failed:', e.message); }
  };

  const handleShowComments = () => {
    const willOpen = !showComments;
    setShowComments(willOpen);
    if (willOpen && comments.length === 0) loadComments();
    // Analytics: track as a post view when user opens comments (engagement signal)
    // ONLY for brand posts — resident posts are never tracked for privacy
    const isBrandPost = post._profile?.account_type === 'brand';
    if (willOpen && typeof post.id !== 'number' && !post.isWelcome && !post.isSponsored && isBrandPost) {
      trackPostView(post.id, currentUser?.id, 'feed');
    }
  };

  const [showReport, setShowReport] = useState(false);
  const isOwn = post.userId === currentUser?.id;
  const user = isOwn
    ? currentUser
    : post._profile
      ? {
          username:        post._profile.username,
          displayName:     post._profile.display_name,
          showDisplayName: post._profile.show_display_name,
          avatar:          post._profile.avatar_url,
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
          {post._profile?.account_type !== 'brand' && user.showDisplayName !== false && user.displayName && user.displayName !== user.username && (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <img src={logo} alt="InCynq" style={{ width: 38, height: 38, objectFit: 'contain', flexShrink: 0, filter: `drop-shadow(0 0 8px ${C.sky}88)` }} />
            <div>
              <div className="sg" style={{ fontWeight: 800, fontSize: 14, color: C.sky }}>InCynq</div>
              <div style={{ fontSize: 11, color: C.muted }}>Just for you</div>
            </div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 10, lineHeight: 1.4 }}>
            Hey {visibleName(currentUser) || 'there'} 👋 &nbsp;You're in. ⚡
          </div>
          <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.8 }}>
            The grid just got a lot less noisy.<br /><br />
            Pick your interests in your profile and your feed will start making sense immediately.<br /><br />
            Good to have you here.<br />
            <span style={{ color: C.sky, fontWeight: 700, display: 'block', marginTop: 8 }}>The InCynq Team</span>
          </div>
          <button onClick={onGoToProfile} style={{ marginTop: 16, width: '100%', padding: '10px 14px', background: `${C.sky}18`, borderRadius: 10, fontSize: 12, color: C.sky, fontWeight: 700, textAlign: 'center', border: `1px solid ${C.sky}33`, cursor: 'pointer' }}>
            👤 Go to Profile → add your interests
          </button>
        </div>
      )}

      {/* Image carousel */}
      {!post.isWelcome && images.length > 0 && (
        <div style={{ position: 'relative' }}>
          {/* Carousel container */}
          <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
            <div 
              style={{ 
                display: 'flex', 
                transition: 'transform 0.3s ease',
                transform: `translateX(-${currentImageIndex * 100}%)`
              }}>
              {images.map((img, i) => (
                <img 
                  key={i} 
                  src={img} 
                  alt="" 
                  style={{ width: '100%', minWidth: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} 
                />
              ))}
            </div>

            {/* Navigation arrows (only if multiple images) */}
            {images.length > 1 && (
              <>
                {currentImageIndex > 0 && (
                  <button
                    onClick={() => setCurrentImageIndex(currentImageIndex - 1)}
                    style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: '#000000aa', color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                    ‹
                  </button>
                )}
                {currentImageIndex < images.length - 1 && (
                  <button
                    onClick={() => setCurrentImageIndex(currentImageIndex + 1)}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: '#000000aa', color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                    ›
                  </button>
                )}
              </>
            )}
          </div>

          {/* Dots indicator (Instagram style) */}
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '8px 0' }}>
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImageIndex(i)}
                  style={{ 
                    width: 6, 
                    height: 6, 
                    borderRadius: '50%', 
                    background: i === currentImageIndex ? C.sky : `${C.muted}66`,
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Caption — below image, before actions (Instagram style) */}
      {!post.isWelcome && post.caption && (
        <div style={{ padding: '10px 14px 4px', fontSize: 13, color: C.sub, lineHeight: 1.5, fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif' }}>
          {post._profile?.account_type !== 'brand' && (
            <span style={{ fontWeight: 800, color: C.text, marginRight: 6, fontFamily: 'inherit' }}>{visibleName(user)}</span>
          )}
          {post.caption}
        </div>
      )}

      {/* Tags */}
      {!post.isWelcome && post.tags && post.tags.length > 0 && (
        <div style={{ padding: '2px 14px 6px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {post.tags.map(tag => (
            <span key={tag} style={{ fontSize: 11, color: C.sky, fontWeight: 600 }}>{tag}</span>
          ))}
        </div>
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const { posts, setPosts, ads, liked, setLiked, toggleLike, saved, toggleSave, myGroups, mySubs, currentUser, setReportQueue, notifications } = useApp();

  const unreadNotifs = notifications.filter(n => !n.read).length;

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
            comments: new Array(p.post_comments?.length || 0).fill(null),
            time: new Date(p.created_at).toLocaleDateString(),
            locationId: p.location_id,
            _profile: p.brand?.id
              ? {
                  username:         p.brand.username,
                  display_name:     p.brand.brand_name,
                  avatar_url:       p.brand.brand_logo_url,
                  show_display_name: true,
                  account_type:     'brand',
                }
              : p.profiles,
          }));
          setPosts(prev => {
            const welcomePost = prev.find(p => p.isWelcome);
            return welcomePost ? [welcomePost, ...mapped] : mapped;
          });

          // Analytics: batch log impressions for BRAND POSTS ONLY (fire-and-forget)
          // Resident posts are never tracked — privacy-first
          if (currentUser?.id) {
            const brandPostIds = dbPosts
              .filter(p => p.brand?.id || p.profiles?.account_type === 'brand')
              .map(p => p.id);
            if (brandPostIds.length > 0) {
              trackImpressionsBatch(brandPostIds, currentUser.id, 'feed');
            }
          }
        }
      } catch (e) {
        console.warn('Could not load posts from Supabase:', e.message);
      } finally {
        setLoadingPosts(false);
      }
    };
    loadPosts();
  }, []);

  const [liveAds, setLiveAds] = useState([]);

  // Load active ads from Supabase
  useEffect(() => {
    const loadAds = async () => {
      try {
        const data = await getActiveAds();
        setLiveAds(data);
      } catch (e) {
        console.warn('Could not load ads:', e.message);
      }
    };
    loadAds();
  }, []);

  const activeAds = ads.filter(a => a.expiresAt > Date.now());

  const feed = (() => {
    const result = [];
    const accountAge = currentUser.createdAt ? Date.now() - new Date(currentUser.createdAt).getTime() : 0;
    const isNewUser = !currentUser.createdAt || accountAge < 86400000;
    const welcomePost = posts.find(p => p.isWelcome);
    if (isNewUser && welcomePost) {
      result.push({ type: 'post', data: welcomePost });
    }

    // Use live ads from Supabase, filtered by maturity + interest groups
    const user = { groups: myGroups, subs: mySubs, maturity: currentUser.maturity, adultVerified: currentUser.adultVerified };
    const matchedAds = liveAds.filter(a => adMatchesUser({
      adMaturity: a.ad_maturity || 'general',
      isRandom:   a.is_random,
      groups:     a.groups || [],
    }, user));
    const premiumAds  = matchedAds.filter(a => a.tier === 'premium');
    const featuredAds = matchedAds.filter(a => a.tier === 'featured');
    const allInjectable = [...premiumAds, ...featuredAds];
    let qi = 0;
    const feedPosts = posts.filter(p => !p.isWelcome);
    feedPosts.forEach((p, i) => {
      result.push({ type: 'post', data: p });
      if ((i === 1 || (i > 1 && (i + 1) % 3 === 0)) && qi < allInjectable.length) {
        result.push({ type: 'sponsored', data: allInjectable[qi++] });
      }
    });
    return result;
  })();

  return (
    <div>
      {/* Overlays */}
      {showHelp          && <HelpScreen onClose={() => setShowHelp(false)} />}
      {showCompose       && <ComposeScreen onClose={() => setShowCompose(false)} />}
      {showNotifications && <NotificationsScreen onClose={() => setShowNotifications(false)} />}

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={logo} alt="InCynq" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <span className="sg" style={{ fontWeight: 900, fontSize: 20, background: `linear-gradient(135deg,${C.sky},${C.peach})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>InCynq</span>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <button onClick={() => setShowCompose(true)} style={{ width: 28, height: 28, borderRadius: '50%', background: `${C.sky}22`, border: `1.5px solid ${C.sky}66`, color: C.sky, fontWeight: 900, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, paddingBottom: 1 }}>+</button>
          {/* Bell with unread badge */}
          <button onClick={() => setShowNotifications(true)} style={{ position: 'relative', fontSize: 20, lineHeight: 1 }}>
            🔔
            {unreadNotifs > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: '#ff3366', color: '#fff',
                fontSize: 9, fontWeight: 900,
                width: 16, height: 16, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1.5px solid ${C.card}`,
              }}>
                {unreadNotifs > 9 ? '9+' : unreadNotifs}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowHelp(true)}
            style={{ width: 28, height: 28, borderRadius: '50%', background: `${C.sky}22`, border: `1.5px solid ${C.sky}66`, color: C.sky, fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >?</button>
        </div>
      </div>

      {/* Feed */}
      <div style={{ paddingBottom: 80 }}>
        {loadingPosts && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
            <div style={{ fontSize: 28, marginBottom: 10, animation: 'pulse 1.5s infinite' }}>⚡</div>
            <div style={{ fontSize: 13 }}>Loading your feed…</div>
          </div>
        )}

        {feed.map((item, idx) => {
          if (item.type === 'sponsored') {
            const ad = item.data;
            return (
              <div key={`sp_${ad.id}`} style={{ padding: '0 0 2px' }}>
                {myGroups.length > 0 && !ad.is_random && (
                  <div style={{ padding: '4px 14px', background: `${C.sky}11`, fontSize: 11, color: C.sky, fontWeight: 700 }}>🎯 Based on your interests</div>
                )}
                <AdCard ad={ad} />
              </div>
            );
          }
          const p = item.data;
          return (
            <PostCard key={p.id} post={p}
              onLike={toggleLike} onSave={toggleSave}
              liked={liked.has(p.id)} saved={saved.has(p.id)}
              currentUser={currentUser}
              onReport={async r => {
                setReportQueue(prev => [...prev, { ...r, id: Date.now() }]);
                try {
                  const { createReport } = await import('../lib/db');
                  await createReport({ postId: p.id, reporterId: currentUser.id, reason: r.reason });
                } catch(e) { console.warn('Report failed:', e.message); }
              }}
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
                    // Notify post owner
                    if (p.userId && p.userId !== currentUser.id) {
                      createNotification({
                        userId:  p.userId,
                        type:    'like',
                        actorId: currentUser.id,
                        postId:  id,
                      });
                    }
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
