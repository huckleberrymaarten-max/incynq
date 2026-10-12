import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import logo from '../assets/Q_Logo_.png';

const TEAL = '#00B4C8';
const GOLD = '#F4B942';
const NAVY = '#040f14';
const CARD = '#0d1f2d';

export default function PublicBrandProfile({ username }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        // The shareable link is incynq.app/brand/<brand_handle>, so the handle
        // is what has to be looked up FIRST. This only ever matched `username`,
        // which happens to work for a resident's own brand — their row is
        // named after them — and never for a second brand, whose username is a
        // generated string like nexysrent_mv4gtdvk. The miss then bounced the
        // visitor to the resident profile, where the brand rendered as a person.
        //
        // account_type also has to allow founding_brand, or the earliest and
        // most prominent brands are the ones that don't resolve.
        const lower = String(username || '').toLowerCase();
        const COLUMNS = 'username, display_name, brand_name, brand_handle, brand_description, brand_logo_url, brand_activated_at, founding_brand_number, avatar_url, bio';
        const TYPES   = ['brand', 'founding_brand'];

        let { data } = await supabase
          .from('profiles')
          .select(COLUMNS)
          .eq('brand_handle', lower)
          .in('account_type', TYPES)
          .maybeSingle();

        if (!data) {
          ({ data } = await supabase
            .from('profiles')
            .select(COLUMNS)
            .eq('username', lower)
            .in('account_type', TYPES)
            .maybeSingle());
        }

        if (!data) {
          // No brand found — redirect to resident profile
          window.location.replace('https://incynq.app/profile/' + username);
          return;
        }
        setProfile(data);
      } catch (e) {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [username]);

  const openApp = () => {
    window.location.href = 'https://incynq.app';
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src={logo} alt="InCynq" style={{ width: 60, opacity: 0.6, animation: 'float 3s ease-in-out infinite' }} />
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: NAVY, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: '#fff', padding: 24, textAlign: 'center' }}>
      <img src={logo} alt="InCynq" style={{ width: 60, marginBottom: 24, opacity: 0.6 }} />
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Brand not found</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>This brand doesn't exist or may have been removed.</div>
      <button onClick={openApp} style={{ background: TEAL, border: 'none', borderRadius: 12, padding: '12px 28px', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        Open InCynq
      </button>
    </div>
  );

  const brandName = profile.brand_name || profile.display_name;
  const logoUrl   = profile.brand_logo_url || profile.avatar_url;
  const isFounder = !!profile.founding_brand_number;

  return (
    <div style={{ minHeight: '100vh', background: NAVY, fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff' }}>

      {/* Header */}
      <div style={{ background: CARD, borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={logo} alt="InCynq" style={{ width: 28, height: 28 }} />
        <span style={{ fontWeight: 800, fontSize: 16, color: TEAL }}>InCynq</span>
      </div>

      {/* Profile card */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 40px' }}>

        {/* Logo + name */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, overflow: 'hidden', background: `${TEAL}22`, border: `2px solid ${TEAL}44`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
            {logoUrl
              ? <img src={logoUrl} alt={brandName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : '🏷️'
            }
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{brandName}</div>
            {/* The handle, not the row name — nobody should ever be shown
                nexysrent_mv4gtdvk on a page the brand hands out. */}
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>@{profile.brand_handle || profile.username}</div>
            {isFounder && (
              <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, background: `${GOLD}18`, border: `1px solid ${GOLD}44`, borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: GOLD }}>
                ⭐ Founding Brand #{profile.founding_brand_number}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {profile.brand_description && (
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, marginBottom: 28, padding: '14px 16px', background: CARD, borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
            {profile.brand_description}
          </div>
        )}

        {/* CTA */}
        <div style={{ background: `${TEAL}11`, border: `1px solid ${TEAL}33`, borderRadius: 18, padding: '24px 20px', textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Follow {brandName} on InCynq</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, lineHeight: 1.6 }}>
            Open the InCynq app to follow this brand and see their posts, events and announcements in your feed.
          </div>
          <button
            onClick={openApp}
            style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${TEAL}, #00e5a0)`, color: '#040f14', fontWeight: 800, fontSize: 16, cursor: 'pointer', marginBottom: 10 }}>
            Open InCynq to Follow →
          </button>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            Don't have an account? <a href="https://incynq.app" style={{ color: TEAL, textDecoration: 'none', fontWeight: 600 }}>Join free</a>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          InCynq · Connect with what matters. · <a href="https://incynq.net" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>incynq.net</a>
        </div>
      </div>
    </div>
  );
}
