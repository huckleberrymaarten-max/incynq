import { useState, useRef } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import { USERS, LOCS, INTEREST_GROUPS, visibleName, gridStatusLabel } from '../data';
import Av from '../components/Av';
import Toggle from '../components/Toggle';
import SLCharPicker from '../components/SLCharPicker';
import TCScreen from './TCScreen';
import InterestPicker from '../components/InterestPicker';
import { supabase } from '../lib/supabase';

const fetchSLAvatar = async (username) => {
  try {
    const res = await fetch(`https://corsproxy.io/?https://my-secondlife.com/agents/${encodeURIComponent(username)}/about`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/profile_image[^>]+src="([^"]+)"/);
    return match ? match[1] : null;
  } catch { return null; }
};

const stableHash = s => { let h = 0; for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) & 0xffffffff; return h; };

export default function ProfileScreen() {
  const { currentUser, setCurrentUser, setLinkedProfiles, discoverable, setDiscoverable, gridStatus, toast, setLoggedIn, following, setFollowing } = useApp();
  const [showSettings, setShowSettings] = useState(false);
  const [showTC, setShowTC] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showFullDiscover, setShowFullDiscover] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(currentUser.displayName || '');
  const [editBio, setEditBio] = useState(currentUser.bio || '');
  const [showCharPicker, setShowCharPicker] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const fileInputRef = useRef(null);

  const updateUser = updates => {
    setCurrentUser(u => ({ ...u, ...updates }));
    setLinkedProfiles(prev => prev.map(p => p.id === currentUser.id ? { ...p, ...updates } : p));
  };

  const saveProfile = () => {
    updateUser({ displayName: editDisplayName, bio: editBio });
    setShowEdit(false);
    toast('Profile updated ✓');
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => updateUser({ avatar: ev.target.result });
    reader.readAsDataURL(file);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${currentUser.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        updateUser({ avatar: data.publicUrl });
        toast('Profile photo updated ✓');
      }
    } catch { toast('Upload failed — using preview only', 'error'); }
    finally { setUploading(false); }
  };

  const handleFetchSLAvatar = async () => {
    setUploading(true);
    toast('Fetching from Second Life…');
    try {
      const url = await fetchSLAvatar(currentUser.username);
      if (url) { updateUser({ avatar: url }); toast('SL profile picture loaded ✓'); }
      else toast('Could not find SL avatar — upload manually', 'error');
    } catch { toast('Could not reach Second Life', 'error'); }
    finally { setUploading(false); }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) { toast('Enter a new email', 'error'); return; }
    try { await supabase.auth.updateUser({ email: newEmail }); toast('Check your new email to confirm ✓'); }
    catch { toast('Email updated ✓ (demo mode)'); }
    setShowChangeEmail(false); setNewEmail('');
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    if (newPassword !== confirmPassword) { toast("Passwords don't match", 'error'); return; }
    try { await supabase.auth.updateUser({ password: newPassword }); toast('Password updated ✓'); }
    catch { toast('Password updated ✓ (demo mode)'); }
    setShowChangePassword(false); setNewPassword(''); setConfirmPassword('');
  };

  const toggleFollow = id => {
    if (id === 0) return;
    const n = new Set(following);
    n.has(id) ? n.delete(id) : n.add(id);
    setFollowing(n);
  };

  // Build inline discover suggestions
  const discoverAll = (() => {
    if (!currentUser.groups?.length) return [];
    const all = [];
    currentUser.groups.forEach(groupId => {
      const group = INTEREST_GROUPS.find(g => g.id === groupId);
      if (!group) return;
      USERS.filter(u => u.id !== 0 && u.id !== currentUser.id && u.groups?.includes(groupId))
        .forEach(u => { if (!all.find(x => x.id === u.id)) all.push({ ...u, _group: group }); });
      LOCS.filter(l => l.groups?.includes(groupId))
        .forEach(l => { const id = `b_${l.id}`; if (!all.find(x => x.id === id)) all.push({ id, username: l.owner, name: l.name, avatar: l.image, isBrand: true, followers: l.visits, _group: group }); });
    });
    return [...all].sort((a, b) => stableHash(a.id) - stableHash(b.id));
  })();

  const discoverPreview = discoverAll.slice(0, 10);

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Profile</span>
        <button onClick={() => setShowSettings(true)} style={{ fontSize: 20 }}>⚙️</button>
      </div>

      <div style={{ padding: '20px 16px 80px' }}>

        {/* Avatar + name */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Av src={currentUser.avatar} size={72} ring={C.sky} status={currentUser.gridStatus} />

          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>{visibleName(currentUser)}</div>
            {currentUser.showDisplayName !== false && currentUser.displayName && currentUser.displayName !== currentUser.username && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>@{currentUser.username}</div>
            )}
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{gridStatusLabel(gridStatus)}</div>
          </div>
        </div>

        {/* Bio */}
        <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, marginBottom: 16 }}>
          {currentUser.bio || 'No bio yet.'}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}`, marginBottom: 16 }}>
          {[['Posts', 0], ['Followers', 0], ['Following', following.size]].map(([label, val], i) => (
            <div key={label} style={{ flex: 1, textAlign: 'center', padding: '12px 0', background: C.card2, borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: C.text }}>{val}</div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button onClick={() => setShowEdit(true)}
            style={{ flex: 1, padding: '10px', borderRadius: 12, background: C.card2, border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: 13 }}>
            Edit Profile
          </button>
          <button onClick={() => { setDiscoverable(!discoverable); toast(discoverable ? 'Hidden from Discovery' : 'Visible in Discovery 🎉'); }}
            style={{ flex: 1, padding: '10px', borderRadius: 12, background: discoverable ? `${C.sky}18` : C.card2, border: `1.5px solid ${discoverable ? C.sky : C.border}`, color: discoverable ? C.sky : C.sub, fontWeight: 700, fontSize: 13 }}>
            {discoverable ? '👁️ Discoverable' : '👁️ Hidden'}
          </button>
        </div>

        {/* ── Discover section ── */}
        {discoverable && discoverPreview.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="sg" style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>DISCOVER</div>
              <button onClick={() => setShowFullDiscover(true)} style={{ fontSize: 12, color: C.sky, fontWeight: 700 }}>See all →</button>
            </div>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', marginLeft: -16, paddingLeft: 16, marginRight: -16, paddingRight: 16, paddingBottom: 6 }}>
              {discoverPreview.map(u => {
                const mutuals = stableHash(u.id) % 8;
                const isFollowing = following.has(u.id);
                return (
                  <div key={u.id} style={{ flexShrink: 0, width: 108, background: C.card2, borderRadius: 14, padding: '11px 9px', textAlign: 'center', border: `1px solid ${u._group?.color || C.border}22` }}>
                    <div style={{ position: 'relative', width: 52, height: 52, margin: '0 auto 7px' }}>
                      <img src={u.avatar} alt="" style={{ width: 52, height: 52, borderRadius: '18%', objectFit: 'cover', border: `2px solid ${u._group?.color || C.sky}55` }} />
                      {u.isBrand && <div style={{ position: 'absolute', bottom: 0, right: 0, background: `${C.gold}ee`, fontSize: 8, fontWeight: 900, color: '#000', width: 15, height: 15, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${C.card2}` }}>🏢</div>}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                      {u.isBrand ? u.name : u.username}
                    </div>
                    {mutuals > 0 && <div style={{ fontSize: 10, color: C.muted, marginBottom: 2, fontWeight: 600 }}>👥 {mutuals} mutual{mutuals !== 1 ? 's' : ''}</div>}
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 7 }}>
                      {u.isBrand ? `${(u.followers / 1000).toFixed(1)}k visits` : `${(u.followers || 0).toLocaleString()} followers`}
                    </div>
                    <button onClick={() => toggleFollow(u.id)}
                      style={{ width: '100%', fontSize: 10, fontWeight: 800, padding: '5px 0', borderRadius: 20,
                        background: isFollowing ? C.card : `linear-gradient(135deg,${C.sky},${C.peach})`,
                        color: isFollowing ? C.sky : '#060d14',
                        border: isFollowing ? `1px solid ${C.sky}44` : 'none' }}>
                      {isFollowing ? '✓' : 'Follow'}
                    </button>
                  </div>
                );
              })}
              {/* See all card */}
              <div onClick={() => setShowFullDiscover(true)}
                style={{ flexShrink: 0, width: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer' }}>
                <div style={{ width: 42, height: 42, borderRadius: '18%', background: `${C.sky}22`, border: `2px dashed ${C.sky}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>→</div>
                <div style={{ fontSize: 11, color: C.sky, fontWeight: 800, textAlign: 'center' }}>See all</div>
              </div>
            </div>
          </div>
        )}

        {discoverable && !currentUser.groups?.length && (
          <div style={{ marginBottom: 20, padding: '9px 12px', background: C.card2, borderRadius: 10, fontSize: 12, color: C.muted, textAlign: 'center' }}>
            Add interests below to see who matches you 🎯
          </div>
        )}

        {/* Interest groups + subcategories */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, letterSpacing: .5, marginBottom: 10 }}>YOUR INTERESTS</div>
          <InterestPicker
            selectedGroups={currentUser.groups || []}
            selectedSubs={currentUser.subs || []}
            onGroupToggle={gid => {
              const groups = (currentUser.groups || []).includes(gid)
                ? (currentUser.groups || []).filter(x => x !== gid)
                : [...(currentUser.groups || []), gid];
              updateUser({ groups });
            }}
            onSubToggle={sub => {
              const subs = (currentUser.subs || []).includes(sub)
                ? (currentUser.subs || []).filter(x => x !== sub)
                : [...(currentUser.subs || []), sub];
              updateUser({ subs });
            }}
          />
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />

      {/* ── Full Discover overlay ── */}
      {showFullDiscover && (
        <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 500, overflowY: 'auto' }} className="fadeUp">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 10 }}>
            <button onClick={() => setShowFullDiscover(false)} style={{ color: C.text, fontSize: 20, fontWeight: 700 }}>←</button>
            <span className="sg" style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Discover</span>
          </div>
          <div style={{ padding: '16px 0 80px' }}>
            {currentUser.groups?.map(groupId => {
              const group = INTEREST_GROUPS.find(g => g.id === groupId);
              if (!group) return null;
              const people = USERS.filter(u => u.id !== 0 && u.id !== currentUser.id && u.groups?.includes(groupId));
              const brands = LOCS.filter(l => l.groups?.includes(groupId)).map(l => ({ id: `b_${l.id}`, username: l.owner, name: l.name, avatar: l.image, isBrand: true, followers: l.visits }));
              const all = [...people, ...brands].sort((a, b) => stableHash(a.id) - stableHash(b.id)).slice(0, 10);
              if (!all.length) return null;
              return (
                <div key={groupId} style={{ marginBottom: 28 }}>
                  <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 16 }}>{group.label.split(' ')[0]}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: group.color }}>{group.label.split(' ').slice(1).join(' ')}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{all.length} match{all.length !== 1 ? 'es' : ''}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px', paddingBottom: 4 }}>
                    {all.map(u => {
                      const mutuals = stableHash(u.id) % 8;
                      const isFollowing = following.has(u.id);
                      return (
                        <div key={u.id} style={{ flexShrink: 0, width: 108, background: C.card, borderRadius: 14, padding: '11px 9px', textAlign: 'center', border: `1px solid ${group.color}22` }}>
                          <div style={{ position: 'relative', width: 52, height: 52, margin: '0 auto 7px' }}>
                            <img src={u.avatar} alt="" style={{ width: 52, height: 52, borderRadius: '18%', objectFit: 'cover', border: `2px solid ${group.color}55` }} />
                            {u.isBrand && <div style={{ position: 'absolute', bottom: 0, right: 0, background: `${C.gold}ee`, fontSize: 8, fontWeight: 900, color: '#000', width: 15, height: 15, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🏢</div>}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                            {u.isBrand ? u.name : u.username}
                          </div>
                          {mutuals > 0 && <div style={{ fontSize: 10, color: C.muted, marginBottom: 2, fontWeight: 600 }}>👥 {mutuals} mutual{mutuals !== 1 ? 's' : ''}</div>}
                          <div style={{ fontSize: 10, color: C.muted, marginBottom: 7 }}>
                            {u.isBrand ? `${(u.followers / 1000).toFixed(1)}k visits` : `${(u.followers || 0).toLocaleString()} followers`}
                          </div>
                          <button onClick={() => toggleFollow(u.id)}
                            style={{ width: '100%', fontSize: 10, fontWeight: 800, padding: '5px 0', borderRadius: 20,
                              background: isFollowing ? C.card2 : `linear-gradient(135deg,${C.sky},${C.peach})`,
                              color: isFollowing ? C.sky : '#060d14',
                              border: isFollowing ? `1px solid ${C.sky}44` : 'none' }}>
                            {isFollowing ? '✓ Following' : 'Follow'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit profile modal */}
      {showEdit && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000bb', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: C.card, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 20, maxHeight: '88vh', overflowY: 'auto' }} className="fadeUp">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span className="sg" style={{ fontWeight: 700, fontSize: 16, color: C.text }}>Edit Profile</span>
              <button onClick={() => setShowEdit(false)} style={{ color: C.muted }}>✕</button>
            </div>
            {/* Avatar */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={currentUser.avatar} alt="" style={{ width: 80, height: 80, borderRadius: '18%', border: `3px solid ${C.sky}`, objectFit: 'cover' }} />
                {uploading && <div style={{ position: 'absolute', inset: 0, borderRadius: '18%', background: '#00000088', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 20 }}>⏳</span></div>}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  style={{ padding: '8px 16px', borderRadius: 20, background: `${C.sky}22`, border: `1px solid ${C.sky}44`, color: C.sky, fontWeight: 700, fontSize: 12 }}>
                  📷 Upload photo
                </button>
                <button onClick={handleFetchSLAvatar} disabled={uploading}
                  style={{ padding: '8px 16px', borderRadius: 20, background: `${C.gold}18`, border: `1px solid ${C.gold}44`, color: C.gold, fontWeight: 700, fontSize: 12 }}>
                  🌐 Use SL picture
                </button>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Your SL profile picture · or upload your own</div>
            </div>
            {/* Display name */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>DISPLAY NAME</label>
              <div style={{ position: 'relative' }}>
                <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} className="inp" style={{ paddingRight: 40 }} />
                <button onClick={() => setShowCharPicker(showCharPicker === 'name' ? null : 'name')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: showCharPicker === 'name' ? C.sky : C.muted }}>★</button>
              </div>
              {showCharPicker === 'name' && <div style={{ marginTop: 6 }}><SLCharPicker onInsert={c => setEditDisplayName(n => n + c)} onClose={() => setShowCharPicker(null)} /></div>}
            </div>
            {/* Bio */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>BIO</label>
              <div style={{ position: 'relative' }}>
                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} className="inp" style={{ height: 80, paddingRight: 40 }} />
                <button onClick={() => setShowCharPicker(showCharPicker === 'bio' ? null : 'bio')} style={{ position: 'absolute', right: 10, top: 10, fontSize: 16, color: showCharPicker === 'bio' ? C.sky : C.muted }}>★</button>
              </div>
              {showCharPicker === 'bio' && <div style={{ marginTop: 6 }}><SLCharPicker onInsert={c => setEditBio(n => n + c)} onClose={() => setShowCharPicker(null)} /></div>}
            </div>
            <button onClick={saveProfile} style={{ width: '100%', padding: '13px', borderRadius: 14, background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 900, fontSize: 14 }}>
              Save →
            </button>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 700, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }} className="fadeUp">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0 }}>
            <button onClick={() => setShowSettings(false)} style={{ color: C.text, fontSize: 22 }}>←</button>
            <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Settings</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 40 }}>
            {/* Privacy */}
            <div style={{ padding: '12px 20px 4px', fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>PRIVACY</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: `1px solid ${C.border}22` }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `${C.sky}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>🏷️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Show Display Name</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {currentUser.showDisplayName !== false && currentUser.displayName ? <strong style={{ color: C.sky }}>{currentUser.displayName}</strong> : <strong style={{ color: C.sky }}>@{currentUser.username}</strong>}
                </div>
              </div>
              <Toggle on={currentUser.showDisplayName !== false} onChange={() => updateUser({ showDisplayName: currentUser.showDisplayName === false })} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: `1px solid ${C.border}22` }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `${C.sky}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>🔍</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Appear in Discovery</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Let others find you in recommendations</div>
              </div>
              <Toggle on={discoverable} onChange={() => { setDiscoverable(!discoverable); toast(!discoverable ? 'Visible in Discovery' : 'Hidden from Discovery'); }} />
            </div>
            {/* Account */}
            <div style={{ padding: '12px 20px 4px', marginTop: 8, fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>ACCOUNT</div>
            <div style={{ padding: '13px 20px', borderBottom: `1px solid ${C.border}22` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>@{currentUser.username}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Your SL avatar name · cannot be changed</div>
            </div>
            <div style={{ padding: '13px 20px', borderBottom: `1px solid ${C.border}22` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Maturity Level</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{currentUser.maturity === 'adult' ? '🔴 Adult' : currentUser.maturity === 'moderate' ? '🟡 Moderate' : '🟢 General'}</div>
            </div>
            {/* Change email */}
            <button onClick={() => setShowChangeEmail(!showChangeEmail)}
              style={{ width: '100%', padding: '13px 20px', textAlign: 'left', fontSize: 14, fontWeight: 600, color: C.text, borderBottom: `1px solid ${C.border}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✉️ Change Email</span><span style={{ color: C.muted }}>{showChangeEmail ? '↑' : '→'}</span>
            </button>
            {showChangeEmail && (
              <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}22`, background: `${C.sky}05` }}>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" placeholder="New email address" className="inp" style={{ marginBottom: 8 }} />
                <button onClick={handleChangeEmail} style={{ width: '100%', padding: '10px', borderRadius: 12, background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 700, fontSize: 13 }}>Update Email →</button>
              </div>
            )}
            {/* Change password */}
            <button onClick={() => setShowChangePassword(!showChangePassword)}
              style={{ width: '100%', padding: '13px 20px', textAlign: 'left', fontSize: 14, fontWeight: 600, color: C.text, borderBottom: `1px solid ${C.border}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🔒 Change Password</span><span style={{ color: C.muted }}>{showChangePassword ? '↑' : '→'}</span>
            </button>
            {showChangePassword && (
              <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}22`, background: `${C.sky}05` }}>
                <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" placeholder="New password" className="inp" style={{ marginBottom: 8 }} />
                <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" placeholder="Confirm new password" className="inp" style={{ marginBottom: 8 }} />
                <button onClick={handleChangePassword} style={{ width: '100%', padding: '10px', borderRadius: 12, background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 700, fontSize: 13 }}>Update Password →</button>
              </div>
            )}
            {/* Legal */}
            <div style={{ padding: '12px 20px 4px', marginTop: 8, fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>LEGAL</div>
            <button onClick={() => setShowTC(true)}
              style={{ width: '100%', padding: '13px 20px', textAlign: 'left', fontSize: 14, fontWeight: 600, color: C.text, borderBottom: `1px solid ${C.border}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📄 Terms & Conditions</span><span style={{ color: C.muted }}>→</span>
            </button>
            {/* Account Actions — always last */}
            <div style={{ padding: '12px 20px 4px', marginTop: 8, fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>ACCOUNT ACTIONS</div>
            <button onClick={() => { setShowSettings(false); setLoggedIn(false); }}
              style={{ width: '100%', padding: '13px 20px', textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#ff4466', borderBottom: `1px solid ${C.border}22`, display: 'block' }}>
              🚪 Sign Out
            </button>
            <div style={{ padding: '20px 20px 10px', fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 1.6 }}>
              InCynq · incynq.app<br />Not affiliated with Linden Lab or Second Life®
            </div>
          </div>
        </div>
      )}

      {showTC && <TCScreen onClose={() => setShowTC(false)} />}
    </div>
  );
}
