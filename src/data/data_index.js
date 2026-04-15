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
  { id: 'social',        label: '👥 Social',        color: '#4ecdc4', subs: ['Friends', 'Hangouts', 'Events', 'Groups', 'Networking', 'Community'],             tags: ['#friends', '#hangouts', '#events', '#groups', '#networking', '#community'] },
  { id: 'fashion',       label: '👗 Fashion',        color: '#fb923c', subs: ['Outfits', 'Mesh Bodies', 'Skins & Shapes', 'Hair', 'Accessories', 'Style Blogs'], tags: ['#outfits', '#meshbody', '#skins', '#hair', '#accessories', '#fashion', '#avatarstyle'] },
  { id: 'home',          label: '🏡 Home & Living',  color: '#a78bfa', subs: ['Furniture', 'Decor', 'Landscaping', 'Builds & Prefabs', 'Rentals'],               tags: ['#furniture', '#decor', '#landscaping', '#builds', '#prefabs', '#rentals', '#home'] },
  { id: 'shopping',      label: '🛍️ Shopping',       color: '#f472b6', subs: ['Deals & Discounts', 'New Releases', 'Gacha & Collectibles', 'Store Promos', 'Marketplace'], tags: ['#deals', '#newreleases', '#gacha', '#collectibles', '#marketplace', '#shopping'] },
  { id: 'roleplay',      label: '🎭 Roleplay',        color: '#5b8dee', subs: ['Fantasy', 'Urban & City', 'Medieval', 'Sci-Fi', 'Cyberpunk', 'Adult RP'],        tags: ['#fantasy', '#urban', '#medieval', '#scifi', '#cyberpunk', '#rp', '#roleplay'] },
  { id: 'entertainment', label: '🎶 Entertainment',  color: '#f43f5e', subs: ['DJs & Music', 'Clubs & Nightlife', 'Live Shows', 'Festivals', 'Streaming'],       tags: ['#music', '#dj', '#clubs', '#nightlife', '#liveevents', '#shows', '#festivals'] },
  { id: 'creativity',    label: '🎨 Creativity',      color: '#34d399', subs: ['Photography', 'Art', 'Videography', 'Editing', 'Blogging'],                      tags: ['#photography', '#art', '#videography', '#editing', '#blogging', '#creativity'] },
  { id: 'creators',      label: '⚙️ Creators',        color: '#00b4c8', subs: ['Building', 'Scripting (LSL)', 'Texturing', 'Mesh Creation', 'HUDs & Systems'],   tags: ['#building', '#scripting', '#lsl', '#texturing', '#meshcreation', '#creator'] },
  { id: 'business',      label: '💼 Business',        color: '#fbbf24', subs: ['Selling', 'Vendors', 'Rentals', 'Marketing', 'Commissions'],                     tags: ['#selling', '#vendors', '#rentals', '#marketing', '#business', '#commission'] },
  { id: 'breedables',    label: '🐾 Breedables',      color: '#86efac', subs: ['Horses', 'Cats & Dogs', 'Bunnies', 'Dragons', 'Fantasy Animals', 'Auctions & Trading'], tags: ['#breedables', '#breeding', '#trading', '#auctions', '#amaretto', '#horses', '#bunnies'] },
  { id: 'vehicles',      label: '🚗 Vehicles',         color: '#94a3b8', subs: ['Cars', 'Bikes', 'Aircraft', 'Boats', 'Racing'],                                 tags: ['#cars', '#bikes', '#aircraft', '#boats', '#racing', '#transport'] },
  { id: 'lifestyle',     label: '💞 Lifestyle',        color: '#ff6b9d', subs: ['Dating', 'Partnerships', 'Family', 'Social Circles'],                           tags: ['#dating', '#partners', '#family', '#sociallife', '#friendship'] },
];

export const DAY = 86400000;
const NOW = Date.now();

export const USERS = [
  { id: 1, username: 'sky.dancer',  displayName: '✨ Sky ✨',         avatar: av('SkyDancer'),  bio: 'Fashion blogger & sim explorer', loc: 'Luminos Beach',    groups: ['fashion', 'social', 'shopping'],       gridStatus: 'online',  online: true  },
  { id: 2, username: 'neon.wolf',   displayName: '★ DJ Neon ★',      avatar: av('NeonWolf'),   bio: 'Builder · Scripter · DJ',        loc: 'Neon District',    groups: ['creators', 'entertainment', 'social'], gridStatus: 'friends', online: true  },
  { id: 3, username: 'luna.rose',   displayName: 'Luna ♥ Rose',      avatar: av('LunaRose'),   bio: 'Poet · Artist · Dreamer',        loc: 'Serenity Gardens', groups: ['creativity', 'home'],                  gridStatus: 'hidden',  online: false },
  { id: 4, username: 'cyber.mod',   displayName: '⚡ CyberMod™ ⚡',  avatar: av('CyberMod'),   bio: 'Owner of Neo Tokyo · RP fan',    loc: 'Neo Tokyo',        groups: ['roleplay', 'creators'],                gridStatus: 'online',  online: true  },
  { id: 5, username: 'star.gazer',  displayName: '★彡 StarGazer 彡★', avatar: av('StarGazer'),  bio: 'Space sim builder · Starfall',   loc: 'Starfall',         groups: ['creators', 'roleplay'],                gridStatus: 'hidden',  online: false },
  { id: 0, username: 'incynq',      displayName: 'InCynq',           avatar: `https://api.dicebear.com/9.x/shapes/svg?seed=incynq&backgroundColor=007a87`, bio: 'The home of the grid.', loc: 'incynq.app', groups: [], isOfficial: true, cynqified: true, accountType: 'official', gridStatus: 'online', online: true },
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

export const LOCS = [
  { id: 1, name: 'The Neon Lounge',     owner: 'neon.wolf',    image: IMGS[0], desc: "The grid's biggest nightclub. DJ nights every evening.", slurl: 'secondlife://Neon District/128/128/22',   rating: 4.8, visits: 12400, tags: ['#clubs', '#dj', '#nightlife'],          groups: ['entertainment', 'social'] },
  { id: 2, name: 'Luminos Beach',       owner: 'sky.dancer',   image: IMGS[1], desc: 'Stunning mesh beach with fashion events every weekend.',  slurl: 'secondlife://Luminos/200/100/22',          rating: 4.6, visits: 8900,  tags: ['#fashion', '#beach', '#social'],         groups: ['fashion', 'social'] },
  { id: 3, name: 'Serenity Gardens',    owner: 'luna.rose',    image: IMGS[3], desc: 'Peaceful art garden. Photography welcome.',               slurl: 'secondlife://Serenity/100/100/22',         rating: 4.9, visits: 5200,  tags: ['#art', '#photography', '#peaceful'],     groups: ['creativity'] },
  { id: 4, name: 'Neo Tokyo',           owner: 'cyber.mod',    image: IMGS[2], desc: 'Cyberpunk roleplay sim. Events every evening.',          slurl: 'secondlife://NeoTokyo/64/64/50',           rating: 4.7, visits: 11200, tags: ['#cyberpunk', '#roleplay', '#urban'],      groups: ['roleplay'] },
  { id: 5, name: 'Starfall',            owner: 'star.gazer',   image: IMGS[4], desc: 'Sci-fi space sim with meteor shower events.',             slurl: 'secondlife://Starfall/200/200/120',        rating: 4.5, visits: 6800,  tags: ['#scifi', '#space', '#building'],          groups: ['roleplay', 'creators'] },
  { id: 6, name: 'Crystal Cove Market', owner: 'merchant.pro', image: IMGS[5], desc: '200+ vendors, gacha machines, live music.',              slurl: 'secondlife://Crystal/64/64/22',            rating: 4.3, visits: 15600, tags: ['#shopping', '#gacha', '#market'],         groups: ['shopping'] },
];

export const INIT_POSTS = [
  { id: 1, userId: 2, image: IMGS[0], caption: 'Just finished the new dance floor 🔥 DJ Pulse tonight 8pm SLT!', tags: ['#clubs', '#dj', '#nightlife'], likes: 312, comments: [{ id: 1, userId: 1, text: 'Looks insane!! 🔥', likes: 8 }, { id: 3, userId: 3, text: 'Adding to my picks! 💜', likes: 5 }], time: '2h', locationId: 1 },
  { id: 2, userId: 1, image: IMGS[1], caption: 'Golden hour at Luminos 🌅 New mesh collection this weekend.', tags: ['#fashion', '#outfits'], likes: 847, comments: [{ id: 4, userId: 2, text: 'Stunning shot!', likes: 12 }], time: '4h', locationId: 2 },
  { id: 3, userId: 4, image: IMGS[2], caption: 'Neo Tokyo at night never gets old 🏙 RP events every evening!', tags: ['#cyberpunk', '#rp'], likes: 1203, comments: [{ id: 7, userId: 1, text: 'My fav place on the grid', likes: 24 }], time: '5h', locationId: 4 },
  { id: 4, userId: 3, image: IMGS[3], caption: 'Digital Dreams art panels now live at Serenity 💜 Free for all!', tags: ['#art', '#photography'], likes: 534, comments: [], time: '8h', locationId: 3 },
  { id: 5, userId: 5, image: IMGS[4], caption: 'Meteor shower event Saturday 7pm SLT ✨ Free mesh gifts!', tags: ['#scifi', '#events'], likes: 689, comments: [], time: '11h', locationId: 5 },
  { id: 6, userId: 2, image: IMGS[6], caption: 'Rooftop vibes from The Neon Lounge 🌃 This grid never sleeps!', tags: ['#clubs', '#nightlife'], likes: 421, comments: [], time: '14h', locationId: 1 },
  { id: 7, userId: 0, image: null, caption: '', tags: ['#incynq', '#welcome'], likes: 0, comments: [], time: 'just now', locationId: null, isWelcome: true, displayName: 'there' },
];

export const INIT_ADS = [
  { id: 1, locationId: 4, tier: 'premium',  groups: ['roleplay'],                isRandom: false, adMaturity: 'general', purchasedAt: NOW - DAY,     expiresAt: NOW + 3 * DAY, price: 1500 },
  { id: 2, locationId: 2, tier: 'featured', groups: ['social', 'entertainment'], isRandom: false, adMaturity: 'general', purchasedAt: NOW - 2 * DAY, expiresAt: NOW + DAY,     price: 1350 },
  { id: 3, locationId: 5, tier: 'featured', groups: ['fashion'],                 isRandom: false, adMaturity: 'general', purchasedAt: NOW - DAY,     expiresAt: NOW + 5 * DAY, price: 750  },
  { id: 4, locationId: 6, tier: 'basic',    groups: ['shopping'],                isRandom: false, adMaturity: 'general', purchasedAt: NOW - DAY,     expiresAt: NOW + 2 * DAY, price: 250  },
  { id: 5, locationId: 1, tier: 'basic',    groups: ['social', 'entertainment'], isRandom: true,  adMaturity: 'general', purchasedAt: NOW - DAY,     expiresAt: NOW + 4 * DAY, price: 188  },
];

export const INIT_EVENTS = [
  { id: 1, title: 'DJ Pulse Live @ Neon Lounge',   host: 'neon.wolf',    image: IMGS[0], locationId: 1, slurl: 'secondlife://Neon District/128/128/22', date: '2026-04-15', time: '20:00 SLT', desc: 'The biggest DJ night of the month.', tags: ['#dj', '#nightlife'], rsvps: 247, interested: 89,  groups: ['entertainment'], boosted: true  },
  { id: 2, title: 'Luminos Beach Fashion Show',    host: 'sky.dancer',   image: IMGS[1], locationId: 2, slurl: 'secondlife://Luminos/200/100/22',        date: '2026-04-17', time: '15:00 SLT', desc: 'Annual beach fashion show.',         tags: ['#fashion'],         rsvps: 134, interested: 210, groups: ['fashion'],        boosted: false },
  { id: 3, title: 'Starfall Meteor Shower',        host: 'star.gazer',   image: IMGS[4], locationId: 5, slurl: 'secondlife://Starfall/200/200/120',       date: '2026-04-18', time: '19:00 SLT', desc: 'Meteor shower with free mesh gifts.', tags: ['#scifi', '#events'], rsvps: 312, interested: 445, groups: ['roleplay'],       boosted: false },
  { id: 4, title: 'Crystal Cove Shopping Weekend', host: 'merchant.pro', image: IMGS[5], locationId: 6, slurl: 'secondlife://Crystal/64/64/22',           date: '2026-04-20', time: '10:00 SLT', desc: '200+ vendors, special discounts.',   tags: ['#shopping'],        rsvps: 521, interested: 872, groups: ['shopping'],       boosted: true  },
];

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
