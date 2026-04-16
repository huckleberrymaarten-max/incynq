// ─────────────────────────────────────────
// Sample data — replace with real API calls
// ─────────────────────────────────────────

const av = s =>
  `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(s)}&backgroundColor=b6e3f4,d1d4f9,ffd5dc,c0aede,ffdfbf`;

export const IMGS = [
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
  'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=600&q=80',
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&q=80',
  'https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?w=600&q=80',
  'https://images.unsplash.com/photo-1518599904199-0ca897819ddb?w=600&q=80',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
  'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&q=80',
];

export const INTEREST_GROUPS = [
  { id: 'social',        icon: '👥', label: 'Social',        color: '#4ecdc4', subs: ['Friends', 'Hangouts', 'Events', 'Groups', 'Networking', 'Community'],             tags: ['#friends', '#hangouts', '#events', '#groups', '#networking', '#community'] },
  { id: 'fashion',       icon: '👗', label: 'Fashion',        color: '#fb923c', subs: ['Outfits', 'Mesh Bodies', 'Skins & Shapes', 'Hair', 'Accessories', 'Style Blogs'], tags: ['#outfits', '#meshbody', '#skins', '#hair', '#accessories', '#fashion', '#avatarstyle'] },
  { id: 'home',          icon: '🏡', label: 'Home & Living',  color: '#a78bfa', subs: ['Furniture', 'Decor', 'Landscaping', 'Builds & Prefabs', 'Rentals'],               tags: ['#furniture', '#decor', '#landscaping', '#builds', '#prefabs', '#rentals', '#home'] },
  { id: 'shopping',      icon: '🛍', label: 'Shopping',       color: '#f472b6', subs: ['Deals & Discounts', 'New Releases', 'Gacha & Collectibles', 'Store Promos', 'Marketplace'], tags: ['#deals', '#newreleases', '#gacha', '#collectibles', '#marketplace', '#shopping'] },
  { id: 'roleplay',      icon: '🎭', label: 'Roleplay',        color: '#5b8dee', subs: ['Fantasy', 'Urban & City', 'Medieval', 'Sci-Fi', 'Cyberpunk', 'Adult RP'],        tags: ['#fantasy', '#urban', '#medieval', '#scifi', '#cyberpunk', '#rp', '#roleplay'] },
  { id: 'entertainment', icon: '🎶', label: 'Entertainment',  color: '#f43f5e', subs: ['DJs & Music', 'Clubs & Nightlife', 'Live Shows', 'Festivals', 'Streaming'],       tags: ['#music', '#dj', '#clubs', '#nightlife', '#liveevents', '#shows', '#festivals'] },
  { id: 'creativity',    icon: '🎨', label: 'Creativity',      color: '#34d399', subs: ['Photography', 'Art', 'Videography', 'Editing', 'Blogging'],                      tags: ['#photography', '#art', '#videography', '#editing', '#blogging', '#creativity'] },
  { id: 'creators',      icon: '⚙️', label: 'Creators',        color: '#00b4c8', subs: ['Building', 'Scripting (LSL)', 'Texturing', 'Mesh Creation', 'HUDs & Systems'],   tags: ['#building', '#scripting', '#lsl', '#texturing', '#meshcreation', '#creator'] },
  { id: 'business',      icon: '💼', label: 'Business',        color: '#fbbf24', subs: ['Selling', 'Vendors', 'Rentals', 'Marketing', 'Commissions'],                     tags: ['#selling', '#vendors', '#rentals', '#marketing', '#business', '#commission'] },
  { id: 'breedables',    icon: '🐾', label: 'Breedables',      color: '#86efac', subs: ['Horses', 'Cats & Dogs', 'Bunnies', 'Dragons', 'Fantasy Animals', 'Auctions & Trading'], tags: ['#breedables', '#breeding', '#trading', '#auctions', '#amaretto', '#horses', '#bunnies'] },
  { id: 'vehicles',      icon: '🚗', label: 'Vehicles',         color: '#94a3b8', subs: ['Cars', 'Bikes', 'Aircraft', 'Boats', 'Racing'],                                 tags: ['#cars', '#bikes', '#aircraft', '#boats', '#racing', '#transport'] },
  { id: 'lifestyle',     icon: '💞', label: 'Lifestyle',        color: '#ff6b9d', subs: ['Dating', 'Partnerships', 'Family', 'Social Circles'],                           tags: ['#dating', '#partners', '#family', '#sociallife', '#friendship'] },
];

export const DAY = 86400000;
const NOW = Date.now();

export const USERS = [
  { id: 0, username: 'incynq', displayName: 'InCynq', avatar: `https://api.dicebear.com/9.x/shapes/svg?seed=incynq&backgroundColor=007a87`, bio: 'The home of the grid.', loc: 'incynq.app', groups: [], isOfficial: true, cynqified: true, accountType: 'official', gridStatus: 'online', online: true },
];

// InCynq official user ID — everyone follows this by default
export const INCYNQ_OFFICIAL_ID = 0;

export const ME = {
  id: 1,
  username: 'maarten.huckleberry',
  displayName: 'Maarten Huckleberry',
  showDisplayName: true,
  avatar: av('MaartenHuckleberry'),
  bio: 'InCynq tester',
  loc: 'Second Life',
  groups: ['fashion', 'social', 'entertainment'],
  subs: ['Events', 'Hangouts', 'DJs & Music'],
  gridStatus: 'online',
  accountType: 'resident',
  wallet: 0,
  maturity: 'general',
  activated: true,
};

export const LOCS = [];
export const INIT_POSTS = [
  { id: 7, userId: 0, image: null, caption: '', tags: ['#incynq', '#welcome'], likes: 0, comments: [], time: 'just now', locationId: null, isWelcome: true, displayName: 'there' },
];
export const INIT_ADS = [];
export const INIT_EVENTS = [];
export const REPORT_REASONS = [
  '🌍 Out of This World — real life content, not SL related',
  '🔞 Adult content shown to non-adults',
  '💬 Harassment or bullying',
  '🗣️ Hate speech or discrimination',
  '🚫 Spam or scam',
  '📷 Stolen content / copyright',
  '❌ Impersonation or fake account',
  '⚠️ Other',
];

export const AD_TIERS = [
  { id: 'basic',    name: 'Basic',    basePrice: 250,  icon: '⚡', color: '#00b4c8', desc: 'Highlighted in search & explore',  reach: '~2,000 residents/day' },
  { id: 'featured', name: 'Featured', basePrice: 750,  icon: '⭐', color: '#a78bfa', desc: 'Featured card + injected in feed',  reach: '~6,000 residents/day' },
  { id: 'premium',  name: 'Premium',  basePrice: 1500, icon: '👑', color: '#f0a500', desc: 'Top story + feed + explore banner', reach: '~15,000 residents/day' },
];

export const EVENT_BOOST_TIERS = [
  { id: 'basic',    name: 'Basic',    icon: '⚡', color: '#00b4c8', pricePerDay: 100 },
  { id: 'featured', name: 'Featured', icon: '⭐', color: '#a78bfa', pricePerDay: 250 },
  { id: 'premium',  name: 'Premium',  icon: '👑', color: '#f0a500', pricePerDay: 500 },
];

export const SL_CHARS = {
  Popular:    ['★', '✦', '✧', '✿', '❀', '♥', '❤', '🔥', '✨', '💫', '🌟', '⚡', '🎧', '🌙', '🌸', '💜', '🌺', '🦋', '彡', '꧁', '꧂', '༺', '༻', '🔱'],
  Borders:    ['꧁', '꧂', '༺', '༻', '【', '】', '〖', '〗', '「', '」', '《', '》', '〈', '〉', '❮', '❯', '⟨', '⟩', '»', '«'],
  'Name deco':['★彡', '彡★', '꧁༺', '༻꧂', '✦', '·', '•', '◆', '⊙', '✖', '≋', '∞', '⚜', '♔', '♕', '🌙', 'の', '〜'],
  Symbols:    ['★', '☆', '✦', '✩', '✪', '♠', '♣', '♥', '♦', '♡', '♢', '•', '◆', '◇', '■', '□', '▲', '▽', '●', '○', '✓', '✕', '†', '§', '©', '®', '™', '°', '∞', '≠'],
  Japanese:   ['「', '」', '【', '】', '《', '》', '・', '。', '、', '〜', '…', 'ー', '♪', '♫', '✿', '彡', 'ミ', 'の'],
  Misc:       ['·', '•', '‥', '…', '–', '—', '｜', '¦', '〰', '～', '⁺', '⁻'],
  Emoji:      ['😊', '😎', '🥰', '😍', '🤩', '😈', '👿', '💀', '🎭', '🎨', '🎬', '🎤', '🎧', '🎵', '🎶', '🎸', '🎲', '🎯', '🏆', '🥇', '🎀', '🎁', '🎉', '🎈', '✨', '🌈', '⭐', '🌟', '💫', '🔥', '💥', '🌊', '🌙', '⚡', '🦋'],
};

export const visibleName = user =>
  user?.showDisplayName !== false && user?.displayName
    ? user.displayName
    : user?.username || '';

export const userOf = (id, users = USERS) =>
  users.find(u => u.id === id) || users[0];

export const locOf = (id) => LOCS.find(l => l.id === id);

export const gridStatusColor = s =>
  s === 'online' ? '#00e5a0' : s === 'friends' ? '#fbbf24' : '#2a6070';

export const gridStatusLabel = s =>
  s === 'online' ? '🟢 In-world' : s === 'friends' ? '🟡 Friends only' : '⚫ Offline';

export const groupMultiplier = n =>
  n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 1.8 : n === 3 ? 2.5 : 3;

export const calcAdPrice = (tier, groups, isRandom) => {
  const base = tier.basePrice * groupMultiplier(groups.length);
  return Math.round((isRandom ? base * 0.75 : base) / 50) * 50;
};

export const adMatchesUser = (ad, user) => {
  if (!ad.groups || ad.groups.length === 0) return true;
  const uMat = user.maturity || 'general';
  const matOk =
    ad.adMaturity === 'general' ||
    (ad.adMaturity === 'moderate' && (uMat === 'moderate' || uMat === 'adult')) ||
    (ad.adMaturity === 'adult' && uMat === 'adult');
  if (!matOk) return false;
  return ad.groups.some(g => user.groups?.includes(g));
};

// Default following set — everyone follows InCynq official (id:0)
export const DEFAULT_FOLLOWING = new Set([0, 2, 3, 4, 5]);
