import { supabase } from './supabase';

// ── Interest groups ──
export const getInterestGroups = async () => {
  const { data, error } = await supabase
    .from('interest_groups')
    .select('*, interest_subs(*), icon, tags')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return data;
};

// ── App content (prices, text) ──
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

// ── Auth ──
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

// ── Posts ──


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

// ── Search ──
export const searchProfiles = async (query, currentUserId) => {
  let q = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, show_display_name, account_type, bio')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .neq('account_type', 'official')
    .limit(20);
  if (currentUserId) q = q.neq('id', currentUserId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
};

// ── Likes ──
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

// ── Follows ──
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

// ── Comments ──
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

// ── Post like count ──
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

// ── Reports ──
export const createReport = async ({ postId, reporterId, reason }) => {
  const { data, error } = await supabase
    .from('reports')
    .insert({ post_id: postId, reporter_id: reporterId, reason })
    .select()
    .single();
  if (error) throw error;
  return data;
};
