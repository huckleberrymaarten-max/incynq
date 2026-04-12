import { createContext, useContext, useState } from 'react';
import { ME, INIT_POSTS, INIT_ADS, USERS, DAY } from '../data';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Auth
  const [loggedIn, setLoggedIn] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [currentUser, setCurrentUser] = useState({ ...ME, accountType: 'resident', wallet: 0, gridStatus: 'online' });
  const [linkedProfiles, setLinkedProfiles] = useState([{ ...ME, id: 1, accountType: 'resident', wallet: 0 }]);

  // Content
  const [posts, setPosts] = useState(INIT_POSTS);
  const [ads, setAds] = useState(INIT_ADS);
  const [liked, setLiked] = useState(new Set());
  const [saved, setSaved] = useState(new Set());
  const [following, setFollowing] = useState(new Set([0, 2, 3, 4, 5]));
  const [myGroups, setMyGroups] = useState(ME.groups);
  const [mySubs, setMySubs] = useState(ME.subs);

  // UI
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'like',   user: 'neon.wolf',  text: 'liked your photo',          time: '2m',  read: false },
    { id: 2, type: 'follow', user: 'luna.rose',  text: 'started following you',      time: '15m', read: false },
    { id: 3, type: 'comment',user: 'cyber.mod',  text: 'commented: "Stunning!"',     time: '1h',  read: false },
    { id: 4, type: 'like',   user: 'star.gazer', text: 'liked your photo',          time: '2h',  read: true  },
  ]);
  const [reportQueue, setReportQueue] = useState([]);
  const [suspendedAccounts, setSuspendedAccounts] = useState({});
  const [brandTeams, setBrandTeams] = useState({});
  const [gridStatus, setGridStatus] = useState('online');
  const [discoverable, setDiscoverable] = useState(true);
  const [notif, setNotif] = useState(null);

  // Toast helper
  const toast = (msg, type = 'ok') => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3200);
  };

  // Like/save
  const toggleLike = id => {
    const n = new Set(liked);
    n.has(id) ? n.delete(id) : n.add(id);
    setLiked(n);
  };
  const toggleSave = id => {
    const n = new Set(saved);
    if (n.has(id)) { n.delete(id); toast('Removed from saved'); }
    else { n.add(id); toast('Saved ✓'); }
    setSaved(n);
  };

  // Purchase ad
  const purchaseAd = ({ tier, groups, isRandom, adMaturity, price, locationId, locationName }) => {
    setAds(prev => [...prev, {
      id: Date.now(), locationId: locationId || null, locationName,
      tier, groups, isRandom, adMaturity, price,
      purchasedAt: Date.now(), expiresAt: Date.now() + 7 * DAY,
    }]);
    setCurrentUser(u => ({ ...u, wallet: Math.max(0, (u.wallet || 0) - price) }));
    setLinkedProfiles(prev => prev.map(p => p.id === currentUser.id ? { ...p, wallet: Math.max(0, (p.wallet || 0) - price) } : p));
    toast(`Ad live! ${price.toLocaleString()} L$ charged`, 'gold');
  };

  // Suspend
  const handleSuspend = (accountId, reason) => {
    const existing = suspendedAccounts[accountId];
    const offenceCount = (existing?.offenceCount || 0) + 1;
    const permanent = offenceCount >= 2;
    setSuspendedAccounts(prev => ({ ...prev, [accountId]: { reason, offenceCount, permanent, suspendedAt: Date.now() } }));
    if (accountId === currentUser.id) {
      setCurrentUser(u => ({ ...u, walletFrozen: true }));
    }
    setNotifications(prev => [{
      id: Date.now(), type: 'removed', user: 'InCynq',
      text: permanent ? 'Your account has been permanently banned.' : `Your account has been suspended. Reason: ${reason}`,
      time: 'just now', read: false,
    }, ...prev]);
    toast(permanent ? '🚫 Account permanently banned' : '⏸️ Account suspended', 'gold');
  };

  return (
    <AppContext.Provider value={{
      loggedIn, setLoggedIn,
      showOnboarding, setShowOnboarding,
      currentUser, setCurrentUser,
      linkedProfiles, setLinkedProfiles,
      posts, setPosts,
      ads, setAds,
      liked, toggleLike,
      saved, toggleSave,
      following, setFollowing,
      myGroups, setMyGroups,
      mySubs, setMySubs,
      notifications, setNotifications,
      reportQueue, setReportQueue,
      suspendedAccounts, setSuspendedAccounts,
      brandTeams, setBrandTeams,
      gridStatus, setGridStatus,
      discoverable, setDiscoverable,
      notif, toast,
      purchaseAd,
      handleSuspend,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
