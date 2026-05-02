import { createContext, useContext, useState, useEffect } from 'react';
import { getInterestGroups, getAppContent } from '../lib/db';
import { INTEREST_GROUPS as FALLBACK_GROUPS, AD_TIERS as FALLBACK_TIERS } from '../data';

const ContentContext = createContext(null);

export function ContentProvider({ children }) {
  const [interestGroups, setInterestGroups] = useState(FALLBACK_GROUPS);
  const [appContent, setAppContent] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [groups, content] = await Promise.all([
          getInterestGroups(),
          getAppContent(),
        ]);

        if (groups?.length) {
          // Groups already mapped in getInterestGroups() — use directly
          setInterestGroups(groups);
        }

        if (content) setAppContent(content);
      } catch (err) {
        console.warn('Using fallback content:', err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Ad tiers with live prices from Supabase
  const adTiers = [
    { id: 'basic',    name: 'Basic',    basePrice: parseInt(appContent.ad_price_basic    || 250),  icon: '⚡', color: '#00b4c8', desc: 'Highlighted in search & explore',  reach: '~2,000 residents/day' },
    { id: 'featured', name: 'Featured', basePrice: parseInt(appContent.ad_price_featured || 750),  icon: '⭐', color: '#a78bfa', desc: 'Featured card + injected in feed',  reach: '~6,000 residents/day' },
    { id: 'premium',  name: 'Premium',  basePrice: parseInt(appContent.ad_price_premium  || 1500), icon: '👑', color: '#f0a500', desc: 'Top story + feed + explore banner', reach: '~15,000 residents/day' },
  ];

  return (
    <ContentContext.Provider value={{ interestGroups, appContent, adTiers, loading }}>
      {children}
    </ContentContext.Provider>
  );
}

export const useContent = () => useContext(ContentContext);
