import { useState } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import { calcAdPrice, groupMultiplier, LOCS, INTEREST_GROUPS } from '../data';
import { useContent } from '../context/ContentContext';
import ImageCropModal from '../components/ImageCropModal';

const STEPS = ['Creative', 'Ad Plan', 'Audience', 'Confirm'];

// Reach labels/numbers based on member count
const getReach = (tierId, memberCount) => {
  if (memberCount < 500) {
    if (tierId === 'basic')    return 'Standard reach';
    if (tierId === 'featured') return 'Extended reach';
    if (tierId === 'premium')  return 'Maximum reach';
  } else if (memberCount < 2000) {
    if (tierId === 'basic')    return '~200 residents/day';
    if (tierId === 'featured') return '~600 residents/day';
    if (tierId === 'premium')  return '~1,200 residents/day';
  } else if (memberCount < 10000) {
    if (tierId === 'basic')    return '~800 residents/day';
    if (tierId === 'featured') return '~2,400 residents/day';
    if (tierId === 'premium')  return '~5,000 residents/day';
  } else {
    if (tierId === 'basic')    return '~2,000 residents/day';
    if (tierId === 'featured') return '~6,000 residents/day';
    if (tierId === 'premium')  return '~15,000 residents/day';
  }
  return '';
};

export default function AdvertiseScreen() {
  const { currentUser, ads, purchaseAd, toast } = useApp();
  const [step, setStep] = useState(0);
  const [selLoc, setSelLoc] = useState(null);
  const [customLoc, setCustomLoc] = useState('');
  const [selTier, setSelTier] = useState(null);
  const [selGroups, setSelGroups] = useState([]);
  const [isRandom, setIsRandom] = useState(false);
  const [adMaturity, setAdMaturity] = useState('general');
  const [showModal, setShowModal] = useState(false);
  const [slurl, setSlurl] = useState('');
  const [marketplaceUrl, setMarketplaceUrl] = useState('');
  const [adCaption, setAdCaption] = useState('');
  const [adImageUrl, setAdImageUrl] = useState('');
  const [uploadingAdImage, setUploadingAdImage] = useState(false);
  const [adCropFile, setAdCropFile] = useState(null);

  const { adTiers, appContent } = useContent();
  const tier = adTiers.find(t => t.id === selTier);
  const price = tier ? calcAdPrice(tier, selGroups, isRandom) : 0;
  const locName = selLoc ? selLoc.name : customLoc.trim();
  const hasLink = !!(slurl.trim() || marketplaceUrl.trim());
  // Brand owners always use brand wallet on this screen; managers use it when in managing mode
  const isBrandMode = currentUser.accountType === 'brand' || currentUser.accountType === 'founding_brand' || !!currentUser.managingBrandId;
  const activeBrand = currentUser.managingBrandId
    ? (currentUser.managedBrands || []).find(b => b.id === currentUser.managingBrandId)
    : null;
  const wallet = isBrandMode
    ? (activeBrand ? (activeBrand.brand_wallet || 0) : (currentUser.brandWallet || 0))
    : (currentUser.wallet || 0);
  const canSelectAdult = Array.isArray(currentUser.maturity)
    ? currentUser.maturity.includes('adult')
    : currentUser.maturity === 'adult';
  const activeAds = ads.filter(a => a.expiresAt > Date.now());

  const canProceed = () => {
    if (step === 0) return true; // location, SLURL and marketplace link are all optional
    if (step === 1) return !!selTier;
    if (step === 2) return selGroups.length > 0;
    return true;
  };

  const toggleGroup = gid =>
    setSelGroups(prev => prev.includes(gid) ? prev.filter(x => x !== gid) : [...prev, gid]);

  const reset = () => {
    setStep(0); setSelLoc(null); setCustomLoc('');
    setSelTier(null); setSelGroups([]); setIsRandom(false);
    setAdMaturity('general'); setShowModal(false);
    setSlurl(''); setMarketplaceUrl(''); setAdCaption(''); setAdImageUrl('');
  };

  const handleLaunch = () => {
    if (wallet < price) { toast('Not enough L$ in wallet', 'error'); return; }
    purchaseAd({ tier: selTier, groups: selGroups, isRandom, adMaturity, price, locationId: selLoc?.id || null, locationName: locName || null, slurl: slurl.trim() || null, marketplaceUrl: marketplaceUrl.trim() || null, adCaption: adCaption.trim() || null, adImageUrl: adImageUrl || null });
    reset();
  };

  if (currentUser.accountType !== 'brand' && currentUser.accountType !== 'founding_brand' && !currentUser.managingBrandId) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card }}>
          <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Advertise</span>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📢</div>
          <div className="sg" style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 10 }}>Advertise on InCynq</div>
          <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.7, marginBottom: 24 }}>You need a brand account to run ads. Create one from Settings.</div>
          <div style={{ padding: '12px 16px', background: `${C.sky}0a`, border: `1px solid ${C.sky}22`, borderRadius: 12, fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
            Activation is {(parseInt(appContent.brand_activation_fee) || 3500).toLocaleString()} L$ — which goes straight into your Brand Wallet as ad credit.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Advertise</span>
        <button onClick={() => setShowModal(true)} style={{ background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 800, fontSize: 12, padding: '7px 14px', borderRadius: 20 }}>+ New Ad</button>
      </div>

      <div style={{ padding: '16px 16px 80px' }}>
        {/* Wallet */}
        {currentUser.walletFrozen ? (
          <div style={{ padding: '12px 14px', background: '#ff440011', border: '1px solid #ff440033', borderRadius: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#ff6644', marginBottom: 4 }}>⏸️ Wallet frozen</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>Account suspended. Contact support@incynq.app to appeal.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `linear-gradient(135deg,${C.gold}18,${C.peach}11)`, border: `1.5px solid ${C.gold}44`, borderRadius: 16, padding: '13px 18px', marginBottom: 14 }}>
            <div>
              <div className="sg" style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>L$ WALLET</div>
              <div className="sg" style={{ color: C.gold, fontWeight: 900, fontSize: 24, marginTop: 2 }}>{wallet.toLocaleString()} <span style={{ fontSize: 13 }}>L$</span></div>
            </div>
            <button style={{ background: `linear-gradient(135deg,${C.gold},#d4890a)`, color: '#060d14', fontWeight: 800, fontSize: 12, padding: '8px 16px', borderRadius: 20 }}>+ Top Up</button>
          </div>
        )}

        {/* Active ads */}
        {activeAds.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>ACTIVE ADS</div>
            {activeAds.map(ad => {
              const t = adTiers.find(t => t.id === ad.tier);
              const daysLeft = Math.ceil((ad.expiresAt - Date.now()) / 86400000);
              return (
                <div key={ad.id} style={{ background: C.card, borderRadius: 14, padding: 14, marginBottom: 10, border: `1px solid ${t?.color}33` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: t?.color }}>{t?.icon} {t?.name}</span>
                    <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>● {daysLeft}d left</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>📍 {ad.locationName || 'Custom location'}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Groups: {(ad.groups || []).join(', ')}</div>
                </div>
              );
            })}
          </>
        )}

        {activeAds.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📢</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 8 }}>No active ads</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>Reach residents by interest. Launch pricing is on now.</div>
          </div>
        )}
      </div>

      {/* Ad creation modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000bb', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.card, borderRadius: 24, width: '100%', maxWidth: 460, overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} className="fadeUp">
            {/* Modal header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.border}`, background: `linear-gradient(135deg,${C.sky}18,${C.peach}11)`, flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div className="sg" style={{ color: C.sky, fontWeight: 700, fontSize: 15 }}>📢 Create Ad</div>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{locName || 'Pick your location first'}</div>
                </div>
                <button onClick={reset} style={{ color: C.muted, fontSize: 20 }}>✕</button>
              </div>
              {/* Step progress */}
              <div style={{ display: 'flex', gap: 6 }}>
                {STEPS.map((s, i) => (
                  <div key={s} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ height: 4, borderRadius: 4, background: step > i ? `linear-gradient(90deg,${C.sky},${C.peach})` : step === i ? `${C.sky}44` : C.border, marginBottom: 4, transition: 'background .3s' }} />
                    <div style={{ fontSize: 9, color: step >= i ? C.sky : C.muted, fontWeight: 700 }}>{s}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step content */}
            <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>

              {/* Step 0: Creative */}
              {step === 0 && (
                <div>
                  <div style={{ fontSize: 13, color: C.sub, marginBottom: 14, lineHeight: 1.5 }}>Build your ad. Add an image and caption — the rest is optional.</div>

                  {/* Image upload */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 6, letterSpacing: .5 }}>AD IMAGE (optional)</label>
                    {adImageUrl ? (
                      <div style={{ position: 'relative' }}>
                        <img src={adImageUrl} alt="Ad" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 12, display: 'block' }} />
                        <button onClick={() => setAdImageUrl('')}
                          style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: '#000000aa', color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                      </div>
                    ) : (
                      <label style={{ display: 'block', cursor: 'pointer' }}>
                        <div style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: '28px 20px', textAlign: 'center', background: C.card2 }}>
                          <div style={{ fontSize: 28, marginBottom: 8 }}>{uploadingAdImage ? '⏳' : '🖼️'}</div>
                          <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{uploadingAdImage ? 'Uploading…' : 'Tap to upload image'}</div>
                        </div>
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          e.target.value = '';
                          setAdCropFile(file);
                        }} />
                      </label>
                    )}
                  </div>

                  {/* Caption */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 6, letterSpacing: .5 }}>AD TEXT (optional)</label>
                    <textarea value={adCaption} onChange={e => setAdCaption(e.target.value)}
                      placeholder="e.g. Check out our new collection at Main Store — now open!"
                      className="inp" style={{ resize: 'none', minHeight: 80, fontFamily: 'inherit', lineHeight: 1.5 }} maxLength={280} />
                    <div style={{ fontSize: 10, color: C.muted, textAlign: 'right', marginTop: 2 }}>{adCaption.length}/280</div>
                  </div>

                  {/* Location */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 6, letterSpacing: .5 }}>LOCATION NAME (optional)</label>
                    <input value={customLoc} onChange={e => { setCustomLoc(e.target.value); setSelLoc(null); }}
                      placeholder="e.g. The Neon Lounge — Main Store" className="inp" />
                  </div>

                  {/* SLURL */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 6, letterSpacing: .5 }}>SLURL (optional)</label>
                    <input value={slurl} onChange={e => setSlurl(e.target.value)}
                      placeholder="secondlife://Region/128/128/22" className="inp" />
                  </div>

                  {/* Marketplace */}
                  <div style={{ marginBottom: 4 }}>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 6, letterSpacing: .5 }}>MARKETPLACE LINK (optional)</label>
                    <input value={marketplaceUrl} onChange={e => setMarketplaceUrl(e.target.value)}
                      placeholder="https://marketplace.secondlife.com/..." className="inp" />
                  </div>
                </div>
              )}

              {/* Step 1: Ad Plan */}
              {step === 1 && adTiers.map(t => (
                <div key={t.id} onClick={() => setSelTier(t.id)}
                  style={{ background: selTier === t.id ? `${t.color}11` : C.card2, border: `1.5px solid ${selTier === t.id ? t.color : t.color + '44'}`, borderRadius: 14, padding: 14, marginBottom: 10, cursor: 'pointer', transition: 'all .2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${t.color}22`, border: `1.5px solid ${t.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{t.icon}</div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: selTier === t.id ? t.color : C.text }}>{t.name}</div>
                        <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{t.desc}</div>
                        <div style={{ color: C.sub, fontSize: 11, marginTop: 2 }}>👥 {getReach(t.id, appContent.memberCount || 0)}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="sg" style={{ color: C.gold, fontWeight: 700, fontSize: 17 }}>{t.basePrice.toLocaleString()}</div>
                      <div style={{ color: C.muted, fontSize: 10 }}>L$ base/wk</div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Step 2: Audience */}
              {step === 2 && tier && (
                <div>
                  <div style={{ fontSize: 13, color: C.sub, marginBottom: 4, lineHeight: 1.5 }}>Pick interest groups. More groups = more reach = higher price.</div>
                  <div className="sg" style={{ color: C.gold, fontWeight: 700, marginBottom: 14, fontSize: 12 }}>
                    {selGroups.length === 0 ? 'No groups selected yet' : `${selGroups.length} group${selGroups.length > 1 ? 's' : ''} · ${price.toLocaleString()} L$/week`}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
                    {INTEREST_GROUPS.map(g => {
                      const sel = selGroups.includes(g.id);
                      return (
                        <button key={g.id} onClick={() => toggleGroup(g.id)}
                          style={{ padding: '7px 14px', borderRadius: 20, fontWeight: 700, fontSize: 12, border: `1.5px solid ${sel ? g.color : C.border}`, background: sel ? `${g.color}22` : 'transparent', color: sel ? g.color : C.sub, transition: 'all .15s' }}>
                          {g.label}
                        </button>
                      );
                    })}
                  </div>

                  {selGroups.length > 0 && (
                    <div style={{ background: C.card2, borderRadius: 12, padding: 14, marginBottom: 14, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: .5, marginBottom: 8 }}>PRICING</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: C.sub }}>Base ({tier.name})</span>
                        <span className="sg" style={{ fontSize: 12, color: C.text }}>{tier.basePrice.toLocaleString()} L$</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: C.sub }}>{selGroups.length} group{selGroups.length > 1 ? 's' : ''} ×{groupMultiplier(selGroups.length)}</span>
                        <span className="sg" style={{ fontSize: 12, color: C.text }}>{Math.round(tier.basePrice * groupMultiplier(selGroups.length)).toLocaleString()} L$</span>
                      </div>
                      {isRandom && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: C.green }}>Random −25%</span>
                          <span className="sg" style={{ fontSize: 12, color: C.green }}>−{Math.round(tier.basePrice * groupMultiplier(selGroups.length) * 0.25).toLocaleString()} L$</span>
                        </div>
                      )}
                      <div style={{ height: 1, background: C.border, margin: '8px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Total/week</span>
                        <span className="sg" style={{ fontSize: 16, fontWeight: 900, color: C.gold }}>{price.toLocaleString()} L$</span>
                      </div>
                    </div>
                  )}

                  {selGroups.length > 1 && (
                    <div onClick={() => setIsRandom(!isRandom)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: isRandom ? `${C.green}11` : C.card2, border: `1px solid ${isRandom ? C.green : C.border}`, borderRadius: 12, marginBottom: 14, cursor: 'pointer' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: isRandom ? C.green : C.text }}>Random rotation −25%</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Rotates through groups randomly. Saves 25%.</div>
                      </div>
                      <div style={{ width: 44, height: 24, borderRadius: 12, background: isRandom ? C.green : C.border, transition: 'background .2s', position: 'relative', flexShrink: 0 }}>
                        <div style={{ position: 'absolute', top: 3, left: isRandom ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: isRandom ? '#040f14' : C.muted, transition: 'left .2s' }} />
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: .5, marginBottom: 8 }}>AD MATURITY</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[{ id: 'general', icon: '🟢', label: 'General' }, { id: 'moderate', icon: '🟡', label: 'Moderate' }, { id: 'adult', icon: '🔴', label: 'Adult', locked: !canSelectAdult }].map(m => (
                        <button key={m.id} onClick={() => !m.locked && setAdMaturity(m.id)}
                          style={{ flex: 1, padding: '9px 5px', borderRadius: 10, border: `1.5px solid ${adMaturity === m.id ? C.sky : m.locked ? '#33333355' : C.border}`, background: adMaturity === m.id ? `${C.sky}18` : C.card2, opacity: m.locked ? .4 : 1, cursor: m.locked ? 'not-allowed' : 'pointer', textAlign: 'center', transition: 'all .15s' }}>
                          <div style={{ fontSize: 16 }}>{m.icon}</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: adMaturity === m.id ? C.sky : C.sub, marginTop: 3 }}>{m.label}</div>
                          {m.locked && <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>SL verified</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Confirm */}
              {step === 3 && tier && (
                <div>
                  <div style={{ background: C.card2, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>📍 {locName}</div>
                  </div>
                  {/* Ad preview */}
                  {(adImageUrl || adCaption) && (
                    <div style={{ background: C.card2, borderRadius: 14, overflow: 'hidden', marginBottom: 16, border: `1px solid ${C.border}` }}>
                      {adImageUrl && <img src={adImageUrl} alt="Ad" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />}
                      {adCaption && <div style={{ padding: '10px 14px', fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{adCaption}</div>}
                    </div>
                  )}
                  {[
                    ['Ad Plan', `${tier.icon} ${tier.name}`],
                    ['Duration', '7 days'],
                    ...(locName ? [['Location', locName]] : []),
                    ...(slurl.trim() ? [['SLURL', slurl.trim()]] : []),
                    ...(marketplaceUrl.trim() ? [['Marketplace', marketplaceUrl.trim()]] : []),
                    ['Groups', selGroups.join(', ')],
                    ['Rotation', isRandom ? 'Random' : 'All groups'],
                    ['Maturity', adMaturity === 'adult' ? '🔴 Adult' : adMaturity === 'moderate' ? '🟡 Moderate' : '🟢 General'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ color: C.muted, fontSize: 13 }}>{k}</span>
                      <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 16, padding: 16, background: `linear-gradient(135deg,${C.gold}18,${C.peach}11)`, border: `1.5px solid ${C.gold}44`, borderRadius: 14, marginBottom: wallet < price ? 12 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div className="sg" style={{ color: C.muted, fontSize: 11, letterSpacing: 1 }}>TOTAL COST</div>
                      <div className="sg" style={{ color: C.gold, fontWeight: 700, fontSize: 28 }}>{price.toLocaleString()} <span style={{ fontSize: 14 }}>L$</span></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: C.muted, fontSize: 11 }}>Your wallet</div>
                      <div className="sg" style={{ color: wallet >= price ? C.green : '#ff6644', fontWeight: 700, fontSize: 14 }}>{wallet.toLocaleString()} L$</div>
                    </div>
                  </div>
                  {wallet < price && (
                    <div style={{ padding: '12px 14px', background: '#ff440011', border: '1px solid #ff440033', borderRadius: 12, marginBottom: 4 }}>
                      <div style={{ fontSize: 13, color: '#ff8866', fontWeight: 700, marginBottom: 4 }}>Not enough L$</div>
                      <div style={{ fontSize: 12, color: C.muted }}>You need {(price - wallet).toLocaleString()} L$ more.</div>
                    </div>
                  )}
                  <div style={{ marginTop: 10, padding: '9px 12px', background: `${C.sky}0a`, border: `1px solid ${C.sky}22`, borderRadius: 10, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                    💡 Launch pricing — rates increase as InCynq grows. Early brands get the best deal.
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '0 18px 20px', display: 'flex', gap: 10, flexShrink: 0, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              {step > 0 && (
                <button onClick={() => setStep(step - 1)}
                  style={{ flex: '0 0 80px', background: C.card2, color: C.sub, fontWeight: 700, fontSize: 13, padding: '12px', borderRadius: 14, border: `1px solid ${C.border}` }}>
                  ← Back
                </button>
              )}
              <button
                onClick={() => { if (!canProceed()) return; if (step < 3) setStep(step + 1); else handleLaunch(); }}
                disabled={!canProceed() || (step === 3 && wallet < price) || currentUser.walletFrozen}
                style={{ flex: 1, background: canProceed() && !(step === 3 && wallet < price) && !currentUser.walletFrozen ? `linear-gradient(135deg,${C.sky},${C.peach})` : C.border, color: canProceed() && !(step === 3 && wallet < price) ? 'white' : C.muted, fontWeight: 800, fontSize: 14, padding: '13px', borderRadius: 14, transition: 'all .2s' }}>
                {currentUser.walletFrozen ? 'Account suspended' : step === 3 ? wallet >= price ? '🚀 Launch Ad →' : 'Top up first' : step === 2 ? 'Review →' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}
      {adCropFile && (
        <ImageCropModal
          file={adCropFile}
          onCancel={() => setAdCropFile(null)}
          onCrop={async (previewUrl, croppedFile) => {
            setAdCropFile(null);
            setAdImageUrl(previewUrl);
            setUploadingAdImage(true);
            try {
              const { uploadPostImage } = await import('../lib/db');
              const url = await uploadPostImage(currentUser.id, croppedFile);
              setAdImageUrl(url);
            } catch (err) {
              console.warn('Ad image upload failed:', err.message);
            } finally {
              setUploadingAdImage(false);
            }
          }}
        />
      )}
    </div>
  );
}
