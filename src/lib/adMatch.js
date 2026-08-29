// ── Ad matching — shared by FeedScreen and SearchScreen ──────
// Kept in one place deliberately: this gates ADULT content, and two drifting
// copies of that check is exactly the bug you don't want.
//
// LOCKED MODEL:
//   General  → sees General only
//   Moderate → sees General + Moderate
//   Adult    → sees General + Moderate + Adult (requires adult_verified)
//
// A user sees an ad IF the ad's maturity level ≤ the user's highest enabled level.

export const MATURITY_RANK = { general: 0, moderate: 1, adult: 2 };

export const adMatchesUser = (ad, user) => {
  // Parse maturity — handle string, array, and double-encoded values
  let maturityArr = user.maturity;
  if (typeof maturityArr === 'string') {
    try { maturityArr = JSON.parse(maturityArr); } catch { maturityArr = [maturityArr]; }
  }
  if (!Array.isArray(maturityArr)) maturityArr = ['general'];
  // Flatten double-encoded entries like '["general","moderate","adult"]'
  maturityArr = maturityArr.flatMap(m => {
    if (typeof m === 'string' && m.startsWith('[')) {
      try { return JSON.parse(m); } catch { return [m]; }
    }
    return [m];
  });

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

// Convenience: filter a raw list of Supabase ad rows for one user.
export const matchAdsForUser = (ads, user) =>
  (ads || []).filter(a => adMatchesUser({
    adMaturity: a.ad_maturity || 'general',
    isRandom:   a.is_random,
    groups:     a.groups || [],
  }, user));

// Fisher-Yates. Used so placement rotates instead of rewarding purchase order.
export const shuffleAds = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
