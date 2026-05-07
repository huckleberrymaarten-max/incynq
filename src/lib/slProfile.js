/**
 * src/lib/slProfile.js
 * ─────────────────────
 * Thin client wrapper around the `sl-profile` Supabase edge function.
 * All calls to api.secondlife.com go through the edge function —
 * the browser never contacts Linden Lab directly.
 *
 * Usage:
 *   import { fetchSLProfile } from '../lib/slProfile';
 *
 *   const { uuid, username, displayName, pictureUrl } =
 *     await fetchSLProfile('maarten.huckleberry');
 */

import { supabase } from './supabase';

/**
 * @typedef {Object} SLProfile
 * @property {string} uuid         — Avatar UUID (Linden key)
 * @property {string} username     — Normalised SL username (dot-separated, lowercase)
 * @property {string} displayName  — SL display name (may differ from username)
 * @property {string} pictureUrl   — Profile picture URL (via secondlife.com CDN)
 */

/**
 * Fetch a Second Life avatar's public profile data.
 * Accepts any of: "Firstname.Lastname" | "Firstname Lastname" | "firstname"
 *
 * @param   {string}            username
 * @returns {Promise<SLProfile>}
 * @throws  {Error} with a user-readable .message on failure
 */
export async function fetchSLProfile(username) {
  if (!username?.trim()) {
    throw new Error('Please enter your Second Life username.');
  }

  const { data, error } = await supabase.functions.invoke('sl-profile', {
    body: { username: username.trim() },
  });

  if (error) {
    console.error('[slProfile] invocation error:', error);
    throw new Error(
      'Could not reach the SL profile service. Check your connection and try again.'
    );
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data?.uuid) {
    throw new Error('No profile data returned — the username may be invalid.');
  }

  return {
    uuid:        data.uuid,
    username:    data.username,
    displayName: data.displayName,
    pictureUrl:  data.pictureUrl,
  };
}
