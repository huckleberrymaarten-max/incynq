import { supabase } from './supabase';

// ── Interest groups ──────────────────────────────────────
export const getInterestGroups = async () => {
  const { data, error } = await supabase
    .from('interest_groups')
    .select('*, interest_subs(*), icon, tags')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return data;
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
  
  // Auto-follow InCynq official account
  if (data.user?.id) {
    try {
      const { data: incynqProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('account_type', 'official')
        .single();
      
      if (incynqProfile) {
        await supabase
          .from('follows')
          .insert({
            follower_id: data.user.id,
            following_id: incynqProfile.id
          });
      }
    } catch (e) {
      console.warn('Auto-follow InCynq failed:', e.message);
    }
  }
  
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

// Get profiles of users who follow this user (followers list)
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
    .select('*, profiles(username, display_name, avatar_url, show_display_name), post_comments(id)')
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
  // Check if current user is admin/owner/official (can see hidden users)
  let canSeeHidden = false;
  if (currentUserId) {
    const { data: currentUserProfile } = await supabase
      .from('profiles')
      .select('account_type, role')
      .eq('id', currentUserId)
      .single();
    
    canSeeHidden = currentUserProfile?.account_type === 'official' 
      || currentUserProfile?.account_type === 'admin'
      || currentUserProfile?.account_type === 'super_admin'
      || currentUserProfile?.role === 'owner';
  }
  
  let q = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, show_display_name, account_type, bio')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .neq('account_type', 'official');
  
  // Only filter by discoverable if user is NOT an admin/owner/InCynq
  if (!canSeeHidden) {
    q = q.eq('discoverable', true);
  }
  
  q = q.limit(20);
  if (currentUserId) q = q.neq('id', currentUserId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
};

// Get suggested users by interest group (discoverable only, unless admin/owner/InCynq)
export const getSuggestedUsersByGroup = async (groupId, currentUserId, limit = 10) => {
  // Check if current user is admin/owner/official (can see hidden users)
  let canSeeHidden = false;
  if (currentUserId) {
    const { data: currentUserProfile } = await supabase
      .from('profiles')
      .select('account_type, role')
      .eq('id', currentUserId)
      .single();
    
    canSeeHidden = currentUserProfile?.account_type === 'official' 
      || currentUserProfile?.account_type === 'admin'
      || currentUserProfile?.account_type === 'super_admin'
      || currentUserProfile?.role === 'owner';
  }
  
  let q = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, show_display_name, account_type, bio')
    .contains('groups', [groupId])
    .neq('id', currentUserId) // Exclude current user
    .neq('account_type', 'official'); // Exclude InCynq
  
  // Only filter by discoverable if user is NOT an admin/owner/InCynq
  if (!canSeeHidden) {
    q = q.eq('discoverable', true);
  }
  
  q = q.limit(limit);
  const { data, error } = await q;
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
