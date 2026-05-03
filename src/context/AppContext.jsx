import { createContext, useContext, useState } from 'react';
import { ME, INIT_POSTS, INIT_ADS, USERS, DAY, DEFAULT_FOLLOWING } from '../data';
import { savePost, unsavePost } from '../lib/db';

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
  const [following, setFollowing] = useState(DEFAULT_FOLLOWING);
  const [myGroups, setMyGroups] = useState(ME.groups);
  const [mySubs, setMySubs] = useState(ME.subs);

  // UI
  const [notifications, setNotifications] = useState([]);
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

  // Like
  const toggleLike = id => {
    const n = new Set(liked);
    n.has(id) ? n.delete(id) : n.add(id);
    setLiked(n);
  };

  // Save — persists to Supabase for real posts (UUID), local-only for numeric IDs
  const toggleSave = async (id) => {
    const n = new Set(saved);
    const wasSaved = n.has(id);
    wasSaved ? n.delete(id) : n.add(id);
    setSaved(n);
    toast(wasSaved ? 'Removed from saved' : 'Saved ✓');

    // Only persist UUID post IDs (not local numeric ones)
    const isUUID = typeof id === 'string' && id.includes('-');
    if (isUUID && currentUser?.id) {
      try {
        if (wasSaved) await unsavePost(currentUser.id, id);
        else await savePost(currentUser.id, id);
      } catch (e) {
        console.warn('Save failed:', e.message);
      }
    }
  };

  // Add a single notification to the top of the list (for real-time feel)
  const addNotification = (notif) => {
    setNotifications(prev => [notif, ...prev]);
  };

  // Refresh notifications count from Supabase (call after marking read etc.)
  const refreshNotifications = async () => {
    if (!currentUser?.id) return;
    try {
      const { getNotifications } = await import('../lib/db');
      const notifs = await getNotifications(currentUser.id);
      setNotifications(notifs || []);
    } catch (e) {
      console.warn('Notification refresh failed:', e.message);
    }
  };

  // Purchase ad — deducts from correct wallet and saves to Supabase
  const purchaseAd = async ({ tier, groups, isRandom, adMaturity, price, locationId, locationName, slurl, marketplaceUrl, adCaption, adImageUrl }) => {
    try {
      const { placeAd } = await import('../lib/db');

      // Determine which brand is active
      const managingBrandId = currentUser.managingBrandId || null;
      const ownBrandId = (currentUser.accountType === 'brand' || currentUser.accountType === 'founding_brand')
        ? currentUser.id
        : null;
      const brandId = managingBrandId || ownBrandId;

      await placeAd({
        brandId,
        tier, groups, isRandom, adMaturity, price,
        locationId: locationId || null,
        locationName: locationName || null,
        slurl: slurl || null,
        marketplaceUrl: marketplaceUrl || null,
        adCaption: adCaption || null,
        adImageUrl: adImageUrl || null,
      });

      // Update local wallet state
      if (managingBrandId) {
        // Deduct from managed brand's wallet in state
        setCurrentUser(u => ({
          ...u,
          managedBrands: (u.managedBrands || []).map(b =>
            b.id === managingBrandId
              ? { ...b, brand_wallet: Math.max(0, (b.brand_wallet || 0) - price) }
              : b
          ),
        }));
      } else if (ownBrandId) {
        // Deduct from own brand wallet
        setCurrentUser(u => ({ ...u, brandWallet: Math.max(0, (u.brandWallet || 0) - price) }));
      } else {
        // Resident wallet fallback
        setCurrentUser(u => ({ ...u, wallet: Math.max(0, (u.wallet || 0) - price) }));
      }

      toast(`Ad live! ${price.toLocaleString()} L$ charged`, 'gold');
    } catch (e) {
      console.error('purchaseAd failed:', e);
      toast(e.message || 'Could not place ad — try again', 'error');
    }
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
      id: Date.now(), type: 'system', actor: null,
      text: permanent ? 'Your account has been permanently banned.' : `Your account has been suspended. Reason: ${reason}`,
      created_at: new Date().toISOString(), read: false,
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
      liked, setLiked, toggleLike,
      saved, setSaved, toggleSave,
      following, setFollowing,
      myGroups, setMyGroups,
      mySubs, setMySubs,
      notifications, setNotifications, addNotification, refreshNotifications,
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
