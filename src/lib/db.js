import { supabase } from './supabase';

// ── Interest groups ──
export const getInterestGroups = async () => {
  const { data, error } = await supabase
    .from('interest_groups')
    .select('*, interest_subs(*)')
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
export const getPosts = async () => {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const createPost = async ({ userId, caption, imageUrl, tags, locationId }) => {
  const { data, error } = await supabase
    .from('posts')
    .insert({ user_id: userId, caption, image_url: imageUrl, tags, location_id: locationId })
    .select()
    .single();
  if (error) throw error;
  return data;
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
