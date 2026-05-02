import { supabase } from './supabase';

// ── Interest groups ──────────────────────────────────────
export const getInterestGroups = async () => {
  const { data: categories, error } = await supabase
    .from('interest_categories')
    .select('id, name, slug, icon, color, sort_order')
    .order('sort_order');
  if (error) throw error;
  if (!categories?.length) return [];

  // Fetch subcategories for all categories in one query
  const { data: subs } = await supabase
    .from('interest_subcategories')
    .select('id, category_id, name, slug, sort_order')
    .order('sort_order');

  const subsMap = {};
  (subs || []).forEach(s => {
    if (!subsMap[s.category_id]) subsMap[s.category_id] = [];
    subsMap[s.category_id].push(s);
  });

  return categories.map(cat => ({
    id: cat.slug,           // use slug as id so existing group matching still works
    dbId: cat.id,
    icon: cat.icon || '',
    label: cat.name,
    color: cat.color || '#00b4c8',
    subs: (subsMap[cat.id] || []).map(s => s.name),
    tags: [],
  }));
};

// ── App content (prices, text) ───────────────────────────
export const getAppContent = async () => {
  const { data, error } = await supabase
    .from('app_content')
    .select('*');
  if (error) throw error;
  return data.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
};

// ── Auth ─────────────────────────────────────────────────
export const registerUser = async ({ username, email, password }) => {
  const displayName = username.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username.toLowerCase().trim(),
        display_name: displayName,
      }
    }
  });
  if (error) throw error;
  return { ...data, displayName };
};

export const loginUser = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const logoutUser = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
};

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ── Profile stats ────────────────────────────────────────
export const getProfileStats = async (userId) => {
  const [posts, followers, following] = await Promise.all([
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_welcome', false),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  return {
    posts:     posts.count     || 0,
    followers: followers.count || 0,
    following: following.count || 0,
  };
};

// ── Following profiles (for Following list) ──────────────
export const getFollowingProfiles = async (userId) => {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id, profiles!follows_following_id_fkey(id, username, display_name, avatar_url, show_display_name, account_type, grid_status)')
    .eq('follower_id', userId);
  if (error) throw error;
  return data.map(f => f.profiles).filter(Boolean);
};

// Get profiles of users who follow the given user
export const getFollowersProfiles = async (userId) => {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, show_display_name, account_type, grid_status)')
    .eq('following_id', userId);
  if (error) throw error;
  return data.map(f => f.profiles).filter(Boolean);
};

// ── Posts ────────────────────────────────────────────────
export const createPost = async ({ userId, caption, imageUrl, tags }) => {
  const { data, error } = await supabase
    .from('posts')
    .insert({ user_id: userId, caption, image_url: imageUrl, tags })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getPosts = async () => {
  const { data, error } = await supabase
    .from('posts')
    .select('*, profiles(username, display_name, avatar_url, show_display_name, account_type), post_comments(id)')
    .eq('is_welcome', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const uploadPostImage = async (userId, file) => {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('posts').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('posts').getPublicUrl(path);
  return data.publicUrl;
};

// ── Search ───────────────────────────────────────────────
export const searchProfiles = async (query, currentUserId) => {
  let q = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, show_display_name, account_type, bio')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .neq('account_type', 'official')
    .eq('discoverable', true) // Only show discoverable users in search
    .limit(20);
  if (currentUserId) q = q.neq('id', currentUserId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
};

// Get suggested users by interest group (discoverable only)
export const getSuggestedUsersByGroup = async (groupId, currentUserId, limit = 10) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, show_display_name, account_type, bio')
    .contains('groups', [groupId])
    .eq('discoverable', true) // Only show discoverable users
    .neq('id', currentUserId) // Exclude current user
    .neq('account_type', 'official') // Exclude InCynq
    .limit(limit);
  if (error) throw error;
  return data;
};

// ── Likes ────────────────────────────────────────────────
export const getLikes = async (userId) => {
  const { data, error } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set(data.map(l => l.post_id));
};

export const likePost = async (postId, userId) => {
  const { error } = await supabase
    .from('post_likes')
    .insert({ post_id: postId, user_id: userId });
  if (error) throw error;
};

export const unlikePost = async (postId, userId) => {
  const { error } = await supabase
    .from('post_likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);
  if (error) throw error;
};

export const getPostLikeCount = async (postId) => {
  const { count, error } = await supabase
    .from('post_likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);
  if (error) throw error;
  return count || 0;
};

export const updatePostLikeCount = async (postId) => {
  const { count } = await supabase
    .from('post_likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);
  await supabase
    .from('posts')
    .update({ likes: count || 0 })
    .eq('id', postId);
  return count || 0;
};

// ── Follows ──────────────────────────────────────────────
export const getFollows = async (userId) => {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  if (error) throw error;
  return new Set(data.map(f => f.following_id));
};

export const followUser = async (followerId, followingId) => {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) throw error;
};

export const unfollowUser = async (followerId, followingId) => {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) throw error;
};

// ── Comments ─────────────────────────────────────────────
export const getComments = async (postId) => {
  const { data, error } = await supabase
    .from('post_comments')
    .select('*, profiles(username, display_name, avatar_url, show_display_name)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
};

export const addComment = async (postId, userId, text) => {
  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, user_id: userId, text })
    .select('*, profiles(username, display_name, avatar_url, show_display_name)')
    .single();
  if (error) throw error;
  return data;
};

export const deleteComment = async (commentId) => {
  const { error } = await supabase
    .from('post_comments')
    .delete()
    .eq('id', commentId);
  if (error) throw error;
};

// ── Reports ──────────────────────────────────────────────
export const createReport = async ({ postId, reporterId, reason }) => {
  const { data, error } = await supabase
    .from('reports')
    .insert({ post_id: postId, reporter_id: reporterId, reason })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ── Saved posts ───────────────────────────────────────────
export const getSaved = async (userId) => {
  const { data, error } = await supabase
    .from('saved_posts')
    .select('post_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set(data.map(s => s.post_id));
};

export const savePost = async (userId, postId) => {
  const { error } = await supabase
    .from('saved_posts')
    .insert({ user_id: userId, post_id: postId });
  if (error) throw error;
};

export const unsavePost = async (userId, postId) => {
  const { error } = await supabase
    .from('saved_posts')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);
  if (error) throw error;
};

// ── Events ───────────────────────────────────────────────
export const getEvents = async () => {
  const { data, error } = await supabase
    .from('events')
    .select('*, profiles(username, display_name, avatar_url)')
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
};

export const createEvent = async ({ userId, title, locationName, slurl, date, timeSlt, description }) => {
  const { data, error } = await supabase
    .from('events')
    .insert({
      user_id:       userId,
      title,
      location_name: locationName || null,
      slurl:         slurl        || null,
      date:          date         || null,
      time_slt:      timeSlt      || null,
      description:   description  || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getEventRsvps = async (userId) => {
  const { data, error } = await supabase
    .from('event_rsvps')
    .select('event_id, status')
    .eq('user_id', userId);
  if (error) throw error;
  return data;
};

export const upsertRsvp = async (userId, eventId, status) => {
  const { error } = await supabase
    .from('event_rsvps')
    .upsert({ user_id: userId, event_id: eventId, status }, { onConflict: 'event_id,user_id' });
  if (error) throw error;
  try { await supabase.rpc('update_event_counts', { p_event_id: eventId }); } catch {}
};

export const removeRsvp = async (userId, eventId) => {
  const { error } = await supabase
    .from('event_rsvps')
    .delete()
    .eq('user_id', userId)
    .eq('event_id', eventId);
  if (error) throw error;
  try { await supabase.rpc('update_event_counts', { p_event_id: eventId }); } catch {}
};

// ── Notifications ─────────────────────────────────────────
export const getNotifications = async (userId) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, actor:profiles!actor_id(username, display_name, avatar_url, show_display_name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return data;
};

// Creates a notification — silently skips if notifying yourself
export const createNotification = async ({ userId, type, actorId, postId = null, text = null }) => {
  if (!userId || !actorId) return null;
  if (userId === actorId) return null; // never notify yourself
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({ user_id: userId, type, actor_id: actorId, post_id: postId || null, text: text || null })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (e) {
    // Silently fail — notifications should never break the main flow
    console.warn('Notification create failed:', e.message);
    return null;
  }
};

export const markAllNotificationsRead = async (userId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
};

export const markNotificationRead = async (notifId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notifId);
  if (error) throw error;
};

// ── Admin ─────────────────────────────────────────────────
const ADMIN_ROLES = ['admin', 'super_admin', 'moderator', 'support', 'finance', 'content_editor'];

export const adminGetStats = async () => {
  const [users, posts, reports, events] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).not('account_type', 'in', '("official")'),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('is_welcome', false),
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('events').select('*', { count: 'exact', head: true }),
  ]);
  return {
    users:   users.count   || 0,
    posts:   posts.count   || 0,
    reports: reports.count || 0,
    events:  events.count  || 0,
  };
};

export const adminGetUsers = async ({ page = 0, search = '', limit = 20 } = {}) => {
  let q = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, account_type, admin_role, activated, wallet, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * limit, page * limit + limit - 1);
  if (search) q = q.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
};

export const adminUpdateUser = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const adminGetReports = async () => {
  const { data, error } = await supabase
    .from('reports')
    .select('*, reporter:profiles!reporter_id(username, display_name), posts(id, caption, image_url, user_id)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
};

export const adminResolveReport = async (reportId, action, resolvedBy) => {
  const { error } = await supabase
    .from('reports')
    .update({ status: 'resolved', action_taken: action, resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
    .eq('id', reportId);
  if (error) throw error;
};

export const adminDeletePost = async (postId) => {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw error;
};

export const adminUpdateAppContent = async (key, value) => {
  const { error } = await supabase
    .from('app_content')
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;
};

export const adminGetAllEvents = async () => {
  const { data, error } = await supabase
    .from('events')
    .select('*, profiles(username, display_name)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
};

export const adminDeleteEvent = async (eventId) => {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw error;
};

// ══════════════════════════════════════════════════════════════
// REFERRAL SYSTEM
// ══════════════════════════════════════════════════════════════

// Get user's referral stats
export const getReferralStats = async (userId) => {
  try {
    // Get total referrals
    const { count: totalReferrals } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', userId);

    // Get activated referrals
    const { count: activatedReferrals } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', userId)
      .eq('activated', true);

    // Get paid referrals this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: paidThisMonth } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', userId)
      .eq('reward_paid', true)
      .gte('reward_paid_at', startOfMonth.toISOString());

    // Get total earnings
    const { count: totalPaidReferrals } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', userId)
      .eq('reward_paid', true);

    return {
      totalReferrals: totalReferrals || 0,
      activatedReferrals: activatedReferrals || 0,
      paidThisMonth: paidThisMonth || 0,
      totalEarned: (totalPaidReferrals || 0) * 10, // 10 L$ per referral
      remaining: Math.max(0, 10 - (paidThisMonth || 0)), // How many more can be paid this month
    };
  } catch (error) {
    console.error('Get referral stats failed:', error);
    throw error;
  }
};

// Create referral record when someone signs up with a code
export const createReferral = async (referralCode, referredUserId) => {
  try {
    // Find the referrer by their referral code
    const { data: referrer } = await supabase
      .from('profiles')
      .select('id')
      .eq('referral_code', referralCode)
      .single();

    if (!referrer) {
      throw new Error('Invalid referral code');
    }

    // Don't allow self-referrals
    if (referrer.id === referredUserId) {
      throw new Error('Cannot refer yourself');
    }

    // Create the referral record
    const { data, error } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referred_id: referredUserId,
        referral_code: referralCode,
      })
      .select()
      .single();

    if (error) throw error;

    // Update the referred user's profile to track who referred them
    await supabase
      .from('profiles')
      .update({ referred_by_code: referralCode })
      .eq('id', referredUserId);

    return data;
  } catch (error) {
    console.error('Create referral failed:', error);
    throw error;
  }
};

// Process referral reward when someone activates (taps terminal)
export const processReferralReward = async (userId) => {
  try {
    // Call the database function to process the reward
    const { data, error } = await supabase
      .rpc('process_referral_reward', { referred_user_id: userId });

    if (error) throw error;
    return data; // Returns true if reward was paid, false if not
  } catch (error) {
    console.error('Process referral reward failed:', error);
    return false;
  }
};

// Get list of referrals for a user
export const getUserReferrals = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select(`
        id,
        activated,
        activated_at,
        reward_paid,
        reward_paid_at,
        created_at,
        referred:profiles!referrals_referred_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get user referrals failed:', error);
    throw error;
  }
};

// ══════════════════════════════════════════════════════════════
// DYNAMIC MEMBER-BASED PRICING
// ══════════════════════════════════════════════════════════════

// Pricing tier tables (L$ per week) - EVERYONE pays current tier
const PRICING_TIERS = {
  1: { basic: 150,  featured: 400,  premium: 800  }, // 0-1,000 members
  2: { basic: 250,  featured: 750,  premium: 1500 }, // 1,000-5,000 members
  3: { basic: 400,  featured: 1200, premium: 2500 }, // 5,000-15,000 members
  4: { basic: 600,  featured: 1800, premium: 3500 }, // 15,000+ members
};

// Tier thresholds (for display purposes)
const TIER_THRESHOLDS = {
  1: { min: 0,     max: 999,   label: 'Launch' },
  2: { min: 1000,  max: 4999,  label: 'Growth' },
  3: { min: 5000,  max: 14999, label: 'Established' },
  4: { min: 15000, max: null,  label: 'Premium' },
};

// Get current member count
export const getMemberCount = async () => {
  try {
    const { data, error } = await supabase.rpc('get_member_count');
    if (error) throw error;
    return data || 0;
  } catch (error) {
    console.error('Get member count failed:', error);
    return 0;
  }
};

// Get current pricing tier (1-4) - applies to ALL brands
export const getCurrentPricingTier = async () => {
  try {
    const { data, error } = await supabase.rpc('get_current_pricing_tier');
    if (error) throw error;
    return data || 1;
  } catch (error) {
    console.error('Get pricing tier failed:', error);
    return 1; // Default to Tier 1
  }
};

// Get current ad prices (everyone pays the same)
export const getCurrentAdPrices = async () => {
  try {
    const tier = await getCurrentPricingTier();
    const memberCount = await getMemberCount();
    
    return {
      tier,
      prices: PRICING_TIERS[tier],
      memberCount,
      tierInfo: TIER_THRESHOLDS[tier],
      nextTier: tier < 4 ? {
        tier: tier + 1,
        threshold: TIER_THRESHOLDS[tier + 1].min,
        prices: PRICING_TIERS[tier + 1],
      } : null,
    };
  } catch (error) {
    console.error('Get current ad prices failed:', error);
    return {
      tier: 1,
      prices: PRICING_TIERS[1],
      memberCount: 0,
      tierInfo: TIER_THRESHOLDS[1],
      nextTier: null,
    };
  }
};

// Format "Member since" / "Brand since" date
export const formatMemberSince = (date, accountType = 'member') => {
  if (!date) return null;
  
  const d = new Date(date);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  
  const prefix = accountType === 'brand' ? 'Brand since' : 'Member since';
  return `${prefix} ${month} ${year}`;
};

// Get founding brand badge text
export const getFoundingBrandBadge = (foundingNumber) => {
  if (!foundingNumber || foundingNumber > 100) return null;
  return `🌟 Founding Brand ${foundingNumber}/100`;
};

// Get profile by username (for viewing other users)
export const getProfileByUsername = async (username) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username.toLowerCase())
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Get profile by username failed:', error);
    return null;
  }
};

// ══════════════════════════════════════════════════════════════
// ANALYTICS TRACKING (Phase 1 — silent data collection)
// ══════════════════════════════════════════════════════════════

// ── Session ID helper ─────────────────────────────────────
// Groups views within the same browser session to prevent inflation
// from a user repeatedly re-opening the same post in one sitting.
const getAnalyticsSessionId = () => {
  let sessionId = sessionStorage.getItem('incynq_session_id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem('incynq_session_id', sessionId);
  }
  return sessionId;
};

// ── Track post view (when post is opened/expanded) ───────
// Fire-and-forget — never blocks UI, never breaks the app
export const trackPostView = async (postId, viewerId, source = 'feed') => {
  if (!postId) return;
  
  try {
    // Dedupe: don't log same post twice in same session
    const dedupeKey = `pv_${postId}_${getAnalyticsSessionId()}`;
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, '1');
    
    await supabase.from('post_views').insert({
      post_id: postId,
      viewer_id: viewerId || null,
      source,
      session_id: getAnalyticsSessionId(),
    });
  } catch (err) {
    // Silent fail — analytics must never break the app
    console.debug('Analytics: trackPostView failed', err);
  }
};

// ── Track post impression (when post appears in feed) ────
export const trackPostImpression = async (postId, viewerId, source = 'feed') => {
  if (!postId) return;
  
  try {
    const dedupeKey = `pi_${postId}_${getAnalyticsSessionId()}`;
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, '1');
    
    await supabase.from('post_impressions').insert({
      post_id: postId,
      viewer_id: viewerId || null,
      source,
    });
  } catch (err) {
    console.debug('Analytics: trackPostImpression failed', err);
  }
};

// ── Track profile view (when someone visits a profile) ───
// Self-views automatically excluded
export const trackProfileView = async (profileId, viewerId, source = 'direct') => {
  if (!profileId) return;
  if (profileId === viewerId) return; // Don't log self-views
  
  try {
    const dedupeKey = `prv_${profileId}_${getAnalyticsSessionId()}`;
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, '1');
    
    await supabase.from('profile_views').insert({
      profile_id: profileId,
      viewer_id: viewerId || null,
      source,
    });
  } catch (err) {
    console.debug('Analytics: trackProfileView failed', err);
  }
};

// ── Batch track impressions (for feed loads) ─────────────
// More efficient than calling trackPostImpression one by one
export const trackImpressionsBatch = async (postIds, viewerId, source = 'feed') => {
  if (!postIds || postIds.length === 0) return;
  
  try {
    const sessionId = getAnalyticsSessionId();
    const rows = postIds
      .filter(postId => {
        const dedupeKey = `pi_${postId}_${sessionId}`;
        if (sessionStorage.getItem(dedupeKey)) return false;
        sessionStorage.setItem(dedupeKey, '1');
        return true;
      })
      .map(postId => ({
        post_id: postId,
        viewer_id: viewerId || null,
        source,
      }));
    
    if (rows.length === 0) return;
    await supabase.from('post_impressions').insert(rows);
  } catch (err) {
    console.debug('Analytics: trackImpressionsBatch failed', err);
  }
};

// ══════════════════════════════════════════════════════════════
// ANALYTICS QUERIES (for Phase 2 dashboard — ready but unused yet)
// ══════════════════════════════════════════════════════════════

// Get analytics for a single post
export const getPostAnalytics = async (postId) => {
  const { data, error } = await supabase
    .from('post_analytics')
    .select('*')
    .eq('post_id', postId)
    .single();
  
  if (error) throw error;
  return data;
};

// Get all analytics for a brand's posts (with date range)
export const getBrandAnalytics = async (brandId, daysBack = 30) => {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  
  const { data, error } = await supabase
    .from('post_analytics')
    .select('*')
    .eq('author_id', brandId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

// Get profile view count for a brand (last N days)
export const getProfileViewStats = async (profileId, daysBack = 30) => {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  
  const { data, error } = await supabase
    .from('profile_views')
    .select('id, viewer_id, viewed_at, source')
    .eq('profile_id', profileId)
    .gte('viewed_at', since.toISOString());
  
  if (error) throw error;
  
  const uniqueViewers = new Set(data.filter(v => v.viewer_id).map(v => v.viewer_id)).size;
  
  return {
    total_views: data.length,
    unique_viewers: uniqueViewers,
    by_source: data.reduce((acc, v) => {
      const src = v.source || 'unknown';
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {}),
    raw: data,
  };
};

// Get aggregated brand summary (views + impressions across all posts)
export const getBrandSummary = async (brandId, daysBack = 30) => {
  const posts = await getBrandAnalytics(brandId, daysBack);
  const profile = await getProfileViewStats(brandId, daysBack);
  
  const totals = posts.reduce((acc, p) => ({
    total_views: acc.total_views + (p.total_views || 0),
    unique_viewers: acc.unique_viewers + (p.unique_viewers || 0),
    total_impressions: acc.total_impressions + (p.total_impressions || 0),
    unique_impressions: acc.unique_impressions + (p.unique_impressions || 0),
  }), { total_views: 0, unique_viewers: 0, total_impressions: 0, unique_impressions: 0 });
  
  return {
    post_count: posts.length,
    ...totals,
    avg_view_through_rate: posts.length > 0
      ? Math.round(posts.reduce((sum, p) => sum + (parseFloat(p.view_through_rate_pct) || 0), 0) / posts.length * 100) / 100
      : 0,
    profile_views: profile.total_views,
    profile_unique_viewers: profile.unique_viewers,
  };
};

// ══════════════════════════════════════════════════════════════
// DASHBOARD SUBSCRIPTION FUNCTIONS
// Free for residents (blocked), free for official InCynq,
// paid upgrade for brands (500 L$/mo, 3-day grace, auto-renewal)
// ══════════════════════════════════════════════════════════════

// ── Get current dashboard tier for a brand ────────────────
export const getDashboardTier = async (brandId) => {
  try {
    const { data, error } = await supabase.rpc('get_dashboard_tier', { p_brand_id: brandId });
    if (error) throw error;
    return data; // { tier: 'free' | 'upgraded', active, status, is_official, current_period_end, ... }
  } catch (err) {
    console.warn('Get dashboard tier failed:', err.message);
    return { tier: 'free', active: false };
  }
};

// ── Upgrade dashboard (charges wallet 500 L$) ─────────────
export const upgradeDashboard = async (brandId) => {
  try {
    const { data, error } = await supabase.rpc('upgrade_dashboard', { p_brand_id: brandId });
    if (error) throw error;
    return data; // { success: true/false, ...details }
  } catch (err) {
    console.error('Upgrade dashboard failed:', err);
    return { success: false, error: err.message };
  }
};

// ── Get dashboard subscription details ────────────────────
export const getDashboardSubscription = async (brandId) => {
  try {
    const { data, error } = await supabase
      .from('dashboard_subscriptions')
      .select('*')
      .eq('brand_id', brandId)
      .in('status', ['active', 'grace'])
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (err) {
    console.warn('Get subscription failed:', err.message);
    return null;
  }
};

// ── Get dashboard payment history ─────────────────────────
export const getDashboardPayments = async (brandId, limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('dashboard_payments')
      .select('*')
      .eq('brand_id', brandId)
      .order('paid_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('Get payments failed:', err.message);
    return [];
  }
};

// ══════════════════════════════════════════════════════════════
// FREE TIER ANALYTICS QUERIES (every brand + official)
// ══════════════════════════════════════════════════════════════

// ── Basic stats for free tier (last 30 days) ──────────────
export const getBasicBrandStats = async (brandId) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceISO = since.toISOString();

    // Get all posts by brand
    const { data: posts } = await supabase
      .from('posts')
      .select('id, created_at')
      .eq('user_id', brandId)
      .eq('is_welcome', false)
      .gte('created_at', sinceISO);

    const postIds = (posts || []).map(p => p.id);

    // Post views (total + unique)
    let totalViews = 0;
    let uniqueViewers = 0;
    if (postIds.length > 0) {
      const { data: views } = await supabase
        .from('post_views')
        .select('id, viewer_id')
        .in('post_id', postIds);
      totalViews = views?.length || 0;
      uniqueViewers = new Set((views || []).filter(v => v.viewer_id).map(v => v.viewer_id)).size;
    }

    // Impressions
    let totalImpressions = 0;
    if (postIds.length > 0) {
      const { count } = await supabase
        .from('post_impressions')
        .select('*', { count: 'exact', head: true })
        .in('post_id', postIds);
      totalImpressions = count || 0;
    }

    // Profile views
    const { data: profileViews } = await supabase
      .from('profile_views')
      .select('id, viewer_id')
      .eq('profile_id', brandId)
      .gte('viewed_at', sinceISO);
    const profileViewCount = profileViews?.length || 0;
    const uniqueProfileVisitors = new Set((profileViews || []).filter(v => v.viewer_id).map(v => v.viewer_id)).size;

    // Current follower count
    const { count: followerCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', brandId);

    // New followers (last 30 days)
    const { count: newFollowers } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', brandId)
      .gte('created_at', sinceISO);

    return {
      post_count: posts?.length || 0,
      total_views: totalViews,
      unique_viewers: uniqueViewers,
      total_impressions: totalImpressions,
      profile_views: profileViewCount,
      unique_profile_visitors: uniqueProfileVisitors,
      followers: followerCount || 0,
      new_followers: newFollowers || 0,
    };
  } catch (err) {
    console.warn('Basic stats failed:', err.message);
    return null;
  }
};

// ── Simple 7-day view trend (free tier chart) ─────────────
export const getSimpleViewTrend = async (brandId) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    
    const { data: posts } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', brandId)
      .eq('is_welcome', false);
    
    const postIds = (posts || []).map(p => p.id);
    if (postIds.length === 0) return [];

    const { data: views } = await supabase
      .from('post_views')
      .select('viewed_at')
      .in('post_id', postIds)
      .gte('viewed_at', since.toISOString())
      .order('viewed_at', { ascending: true });

    // Group by day
    const dayMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dayMap[d.toISOString().split('T')[0]] = 0;
    }
    (views || []).forEach(v => {
      const day = v.viewed_at.split('T')[0];
      if (dayMap[day] !== undefined) dayMap[day] += 1;
    });

    return Object.entries(dayMap).map(([date, count]) => ({ date, count }));
  } catch (err) {
    console.warn('View trend failed:', err.message);
    return [];
  }
};

// ── Top posts (free tier shows top 3, paid shows all) ─────
export const getTopPosts = async (brandId, limit = 3) => {
  try {
    const { data, error } = await supabase
      .from('post_analytics')
      .select('*, posts!inner(caption, image_url, created_at)')
      .eq('author_id', brandId)
      .order('total_views', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('Top posts failed:', err.message);
    return [];
  }
};

// ══════════════════════════════════════════════════════════════
// PAID TIER ANALYTICS QUERIES (upgraded brands + official)
// ══════════════════════════════════════════════════════════════

// ── Extended 90-day stats ─────────────────────────────────
export const getExtendedBrandStats = async (brandId, daysBack = 90) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    const sinceISO = since.toISOString();

    const { data: posts } = await supabase
      .from('posts')
      .select('id, created_at')
      .eq('user_id', brandId)
      .eq('is_welcome', false)
      .gte('created_at', sinceISO);

    const postIds = (posts || []).map(p => p.id);
    if (postIds.length === 0) {
      return {
        post_count: 0, total_views: 0, unique_viewers: 0,
        total_impressions: 0, total_likes: 0, total_comments: 0,
        avg_vtr: 0, engagement_rate: 0, raw_views: []
      };
    }

    const [viewsRes, imprRes, likesRes, commentsRes] = await Promise.all([
      supabase.from('post_views').select('id, viewer_id, viewed_at').in('post_id', postIds),
      supabase.from('post_impressions').select('id, viewer_id').in('post_id', postIds),
      supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
      supabase.from('post_comments').select('post_id, user_id').in('post_id', postIds),
    ]);

    const views = viewsRes.data || [];
    const impressions = imprRes.data || [];
    const likes = likesRes.data || [];
    const comments = commentsRes.data || [];

    const avgVtr = impressions.length > 0 
      ? Math.round((views.length / impressions.length) * 1000) / 10 
      : 0;
    
    const engagementRate = views.length > 0
      ? Math.round(((likes.length + comments.length) / views.length) * 1000) / 10
      : 0;

    return {
      post_count: posts?.length || 0,
      total_views: views.length,
      unique_viewers: new Set(views.filter(v => v.viewer_id).map(v => v.viewer_id)).size,
      total_impressions: impressions.length,
      total_likes: likes.length,
      total_comments: comments.length,
      avg_vtr: avgVtr,
      engagement_rate: engagementRate,
      raw_views: views, // for time-of-day analysis
    };
  } catch (err) {
    console.warn('Extended stats failed:', err.message);
    return null;
  }
};

// ── Peak viewing hours analysis ───────────────────────────
export const getPeakViewingHours = async (brandId, daysBack = 30) => {
  try {
    const stats = await getExtendedBrandStats(brandId, daysBack);
    if (!stats?.raw_views?.length) return null;

    const hourCounts = Array(24).fill(0);
    stats.raw_views.forEach(v => {
      const hour = new Date(v.viewed_at).getHours();
      hourCounts[hour] += 1;
    });

    const dayOfWeekCounts = Array(7).fill(0);
    stats.raw_views.forEach(v => {
      const dow = new Date(v.viewed_at).getDay();
      dayOfWeekCounts[dow] += 1;
    });

    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const peakDay = dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts));
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return {
      hour_breakdown: hourCounts,
      day_breakdown: dayOfWeekCounts.map((count, i) => ({ day: dayNames[i], count })),
      peak_hour: peakHour,
      peak_day: dayNames[peakDay],
    };
  } catch (err) {
    console.warn('Peak hours failed:', err.message);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════
// SL INTEGRATION — Activation Codes & Wallet Top-Ups
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a fresh activation code for a pending user.
 * Returns ICQ-XXXXXX format. Codes expire after 24 hours.
 * 
 * If user already has an active (unexpired, unused) code, returns that one
 * instead of generating a new one — prevents code spam.
 */
export const createActivationCode = async (userId) => {
  if (!userId) throw new Error('userId required');

  // Check for existing active code first
  const { data: existing } = await supabase
    .from('activation_codes')
    .select('code, expires_at')
    .eq('user_id', userId)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return {
      code: existing.code,
      expires_at: existing.expires_at,
      reused: true,
    };
  }

  // No active code — generate a new one via the SQL function
  const { data, error } = await supabase.rpc('create_activation_code', {
    p_user_id: userId,
  });

  if (error) {
    console.error('createActivationCode error:', error);
    throw error;
  }

  if (!data || !data.success) {
    throw new Error(data?.error || 'Failed to generate activation code');
  }

  return {
    code: data.code,
    expires_at: data.expires_at,
    reused: false,
  };
};

/**
 * Subscribe to live profile updates for a specific user.
 * Calls callback(newProfile) whenever the profile row changes.
 * Returns an unsubscribe function.
 * 
 * Used by PendingScreen to detect activation in real-time when the user
 * activates at an inworld terminal.
 */
export const subscribeToProfile = (userId, callback) => {
  if (!userId) throw new Error('userId required');

  const channel = supabase
    .channel(`profile:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Manually fetch the latest profile state.
 * Useful as a fallback if the real-time subscription misses an update.
 */
export const refreshProfile = async (userId) => {
  if (!userId) throw new Error('userId required');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('refreshProfile error:', error);
    return null;
  }

  return data;
};

/**
 * Create a payment intent for wallet top-up.
 * Returns ICQ-XXXXXX code that the user enters at an InCynq ATM.
 * Codes expire after 15 minutes.
 */
export const createPaymentIntent = async (userId, amountLinden) => {
  if (!userId) throw new Error('userId required');
  if (!amountLinden || amountLinden < 1) throw new Error('Invalid amount');

  const { data, error } = await supabase.rpc('create_payment_intent', {
    p_user_id: userId,
    p_amount: parseInt(amountLinden, 10),
  });

  if (error) {
    console.error('createPaymentIntent error:', error);
    throw error;
  }

  if (!data || !data.success) {
    throw new Error(data?.error || 'Failed to create payment intent');
  }

  return {
    code: data.code,
    expires_at: data.expires_at,
    amount: data.amount,
  };
};

// ══════════════════════════════════════════════════════════════
// ACCOUNT LIFECYCLE — Deactivate / Reactivate / Delete / Cancel
// ══════════════════════════════════════════════════════════════

export const deactivateAccount = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ deactivated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const reactivateAccount = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ deactivated_at: null })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const requestAccountDeletion = async (userId, reason = '') => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      deletion_requested_at: new Date().toISOString(),
      deletion_reason:       reason.trim() || null,
    })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const cancelAccountDeletion = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      deletion_requested_at: null,
      deletion_reason:       null,
    })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ══════════════════════════════════════════════════════════════
// BRAND SYSTEM — #4a + #4b
// ══════════════════════════════════════════════════════════════

// ── Generate a brand activation code + payment intent ─────────
// Called when user completes the Add Brand form.
// Creates a payment_intent with intent_type='brand_activation'.
// User takes this code to the ATM, pays 3,500 L$.
// The sl-webhook calls complete_brand_activation() on receipt.
export const initBrandActivation = async (userId, brandData) => {
  // Save brand info to profile (pending state)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      brand_name:        brandData.name.trim(),
      brand_description: brandData.description.trim(),
      brand_email:       brandData.email?.trim() || null,
      brand_logo_url:    brandData.logoUrl || null,
      brand_pending:     true,
    })
    .eq('id', userId);

  if (profileError) throw profileError;

  // Generate activation code (same format as top-up codes)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = 'ICQ-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

  // Create payment intent — type brand_activation, amount 3500
  const { data, error } = await supabase
    .from('payment_intents')
    .insert({
      user_id:     userId,
      code:        code,
      amount:      3500,
      intent_type: 'brand_activation',
      status:      'pending',
      expires_at:  new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// ── Poll for brand activation status ─────────────────────────
// Called every 3 seconds from AddBrandScreen while waiting.
// Returns true if brand has been activated.
export const checkBrandActivated = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('account_type, brand_wallet, brand_activated_at, brand_name')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data?.account_type === 'brand' ? data : null;
};

// ── Cancel a pending brand activation ────────────────────────
// Clears brand_pending + brand info if user cancels before paying.
export const cancelBrandActivation = async (userId) => {
  const { error } = await supabase
    .from('profiles')
    .update({
      brand_name:        null,
      brand_description: null,
      brand_email:       null,
      brand_logo_url:    null,
      brand_pending:     false,
    })
    .eq('id', userId);

  if (error) throw error;

  // Expire any pending brand activation intents for this user
  await supabase
    .from('payment_intents')
    .update({ status: 'cancelled' })
    .eq('user_id', userId)
    .eq('intent_type', 'brand_activation')
    .eq('status', 'pending');
};

// ── Get brand wallet balance ──────────────────────────────────
export const getBrandWallet = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('brand_wallet')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data?.brand_wallet || 0;
};

// ── Upload brand logo to Supabase storage ─────────────────────
export const uploadBrandLogo = async (userId, file) => {
  const ext  = file.name.split('.').pop();
  const path = `brand-logos/${userId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
};

// ══════════════════════════════════════════════════════════════
// BRAND TEAM — #4c
// ══════════════════════════════════════════════════════════════

// ── Invite a manager by username ─────────────────────────────
export const inviteManager = async (brandOwnerId, managerUsername) => {
  // Look up user by username
  const { data: target, error: lookupError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, account_type')
    .eq('username', managerUsername.trim().toLowerCase())
    .single();

  if (lookupError || !target) throw new Error('User not found. Check the SL username and try again.');
  if (target.id === brandOwnerId) throw new Error('You cannot invite yourself as a manager.');
  if (target.account_type === 'official') throw new Error('This account cannot be a manager.');

  // Check if already a manager or pending
  const { data: existing } = await supabase
    .from('brand_managers')
    .select('id, status')
    .eq('brand_owner_id', brandOwnerId)
    .eq('manager_id', target.id)
    .single();

  if (existing) {
    if (existing.status === 'accepted') throw new Error(`${target.display_name || target.username} is already your manager.`);
    if (existing.status === 'pending')  throw new Error(`An invite is already pending for ${target.display_name || target.username}.`);
    // If previously declined or removed, update to pending
    const { data, error } = await supabase
      .from('brand_managers')
      .update({ status: 'pending', invited_at: new Date().toISOString(), accepted_at: null, removed_at: null })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    // Fall through to notification — reuse invite = data
    const invite = data;
    const { data: owner } = await supabase.from('profiles').select('brand_name, brand_logo_url').eq('id', brandOwnerId).single();
    // Remove old invite notifications before creating new one
    await supabase.from('notifications').delete().eq('user_id', target.id).eq('type', 'manager_invite').eq('actor_id', brandOwnerId);
    await supabase.from('notifications').insert({
      user_id:  target.id,
      type:     'manager_invite',
      actor_id: brandOwnerId,
      text:     JSON.stringify({ invite_id: invite.id, brand_name: owner?.brand_name || 'a brand', brand_logo_url: owner?.brand_logo_url || null }),
      read:     false,
    });
    return { invite, manager: target };
  }

  // Create new invite
  const { data: invite, error } = await supabase
    .from('brand_managers')
    .insert({ brand_owner_id: brandOwnerId, manager_id: target.id, status: 'pending' })
    .select()
    .single();

  if (error) throw error;

  // Get brand owner profile to include brand name in notification
  const { data: owner } = await supabase
    .from('profiles')
    .select('brand_name, brand_logo_url, display_name, username')
    .eq('id', brandOwnerId)
    .single();

  // Create notification for the invited manager (remove any old ones first)
  await supabase.from('notifications').delete().eq('user_id', target.id).eq('type', 'manager_invite').eq('actor_id', brandOwnerId);
  const { error: notifError } = await supabase.from('notifications').insert({
    user_id:    target.id,
    type:       'manager_invite',
    actor_id:   brandOwnerId,
    text:       JSON.stringify({
      invite_id:      invite.id,
      brand_name:     owner?.brand_name || 'a brand',
      brand_logo_url: owner?.brand_logo_url || null,
    }),
    read: false,
  }).select().single();

  if (notifError) {
    console.error('Manager invite notification failed:', notifError.message);
  }

  return { invite, manager: target };
};

// ── Accept a manager invite ───────────────────────────────────
export const acceptManagerInvite = async (inviteId, managerId) => {
  const { data, error } = await supabase
    .from('brand_managers')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', inviteId)
    .eq('manager_id', managerId)
    .eq('status', 'pending')
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ── Decline a manager invite ──────────────────────────────────
export const declineManagerInvite = async (inviteId, managerId) => {
  const { data, error } = await supabase
    .from('brand_managers')
    .update({ status: 'declined' })
    .eq('id', inviteId)
    .eq('manager_id', managerId)
    .eq('status', 'pending')
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ── Remove a manager (brand owner action) ─────────────────────
export const removeManager = async (brandOwnerId, managerId) => {
  const { error } = await supabase
    .from('brand_managers')
    .update({ status: 'removed', removed_at: new Date().toISOString() })
    .eq('brand_owner_id', brandOwnerId)
    .eq('manager_id', managerId);
  if (error) throw error;
};

// ── Get brand team (owner view) ───────────────────────────────
export const getBrandTeam = async (brandOwnerId) => {
  const { data, error } = await supabase
    .from('brand_managers')
    .select(`
      id, status, invited_at, accepted_at,
      manager:manager_id(id, username, display_name, avatar_url)
    `)
    .eq('brand_owner_id', brandOwnerId)
    .in('status', ['pending', 'accepted'])
    .order('invited_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

// ── Get brands this user manages (for account switcher) ────────
export const getManagedBrands = async (userId) => {
  const { data, error } = await supabase
    .from('brand_managers')
    .select(`
      id,
      owner:brand_owner_id(
        id, username, display_name, brand_name, brand_logo_url,
        brand_wallet, brand_description
      )
    `)
    .eq('manager_id', userId)
    .eq('status', 'accepted');
  if (error) throw error;
  return (data || []).map(row => row.owner).filter(Boolean);
};

// ── Get pending manager invites for a user (for notifications) ─
export const getPendingManagerInvites = async (userId) => {
  const { data, error } = await supabase
    .from('brand_managers')
    .select(`
      id, invited_at,
      owner:brand_owner_id(id, username, display_name, brand_name, brand_logo_url)
    `)
    .eq('manager_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  return data || [];
};

// ══════════════════════════════════════════════════════════════
// BRAND REMOVAL — #4e
// ══════════════════════════════════════════════════════════════

export const requestBrandRemoval = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ brand_removal_requested_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const cancelBrandRemoval = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ brand_removal_requested_at: null })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ══════════════════════════════════════════════════════════════
// ADULT VERIFICATION — #5
// ══════════════════════════════════════════════════════════════

/**
 * Set adult_verified = true for a user.
 * Called when user confirms adult status in MaturityScreen.
 * User self-declares they have payment info on file with LL —
 * same standard as Second Life.
 */
export const setAdultVerified = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ adult_verified: true })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

/**
 * Revoke adult verification (e.g. if manager loses access).
 * Also removes 'adult' from maturity array.
 */
export const revokeAdultVerified = async (userId) => {
  // First get current maturity
  const { data: profile } = await supabase
    .from('profiles')
    .select('maturity')
    .eq('id', userId)
    .single();

  const maturity = Array.isArray(profile?.maturity)
    ? profile.maturity.filter(m => m !== 'adult')
    : ['general'];

  const { data, error } = await supabase
    .from('profiles')
    .update({ adult_verified: false, maturity })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};
