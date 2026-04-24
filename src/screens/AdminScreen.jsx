import { useState, useEffect, useRef } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import {
  adminGetStats, adminGetUsers, adminUpdateUser,
  adminGetReports, adminResolveReport, adminDeletePost,
  adminUpdateAppContent, adminGetAllEvents, adminDeleteEvent,
  getAppContent,
} from '../lib/db';

const timeAgo = (dateStr) => {
  if (!dateStr) return '–';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: '2-digit' });
};

const TABS = [
  { id: 'overview',  icon: '📊', label: 'Overview'  },
  { id: 'members',   icon: '👥', label: 'Members'   },
  { id: 'reports',   icon: '🚩', label: 'Reports'   },
  { id: 'content',   icon: '✏️', label: 'Content'   },
  { id: 'events',    icon: '🎉', label: 'Events'    },
];

const ACCOUNT_TYPES = ['resident', 'brand', 'admin', 'super_admin', 'moderator', 'support', 'finance', 'content_editor', 'official'];
const ROLE_COLORS = {
  super_admin:     '#ff4466',
  admin:           '#f0a500',
  moderator:       '#a78bfa',
  support:         '#00b4c8',
  finance:         '#00e5a0',
  content_editor:  '#fb923c',
  brand:           '#5b8dee',
  resident:        '#4a8090',
  official:        '#f0a500',
};

// ── Overview ──────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminGetStats()
      .then(setStats)
      .catch(e => console.warn('Stats failed:', e.message))
      .finally(() => setLoading(false));
  }, []);

  const cards = stats ? [
    { icon: '👥', label: 'Total Members', value: stats.users.toLocaleString(),   color: C.sky },
    { icon: '📝', label: 'Total Posts',   value: stats.posts.toLocaleString(),   color: C.green },
    { icon: '🚩', label: 'Open Reports',  value: stats.reports.toLocaleString(), color: '#ff4466' },
    { icon: '🎉', label: 'Events',        value: stats.events.toLocaleString(),  color: C.gold },
  ] : [];

  return (
    <div style={{ padding: '16px 16px 40px' }}>
      <div style={{ padding: '10px 0 16px', fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>PLATFORM OVERVIEW</div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontSize: 13 }}>Loading stats…</div>
      )}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {cards.map(c => (
            <div key={c.label} style={{ background: C.card, borderRadius: 14, padding: '16px 14px', border: `1px solid ${c.color}33` }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
              <div className="sg" style={{ fontSize: 22, fontWeight: 900, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3, fontWeight: 600 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Admin roles legend */}
      <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: .5, marginBottom: 12 }}>STAFF ROLES</div>
        {[
          { role: 'super_admin',    label: 'Super Admin',     desc: 'Full access — all sections' },
          { role: 'admin',          label: 'Admin',           desc: 'Users, reports, content, events' },
          { role: 'moderator',      label: 'Moderator',       desc: 'Reports + user moderation' },
          { role: 'support',        label: 'Support',         desc: 'Read-only + report viewing' },
          { role: 'finance',        label: 'Finance',         desc: 'Wallet management only' },
          { role: 'content_editor', label: 'Content Editor',  desc: 'Prices, FAQ, T&C editing' },
        ].map(r => (
          <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20,
              background: `${ROLE_COLORS[r.role]}22`, color: ROLE_COLORS[r.role],
              border: `1px solid ${ROLE_COLORS[r.role]}44`, flexShrink: 0, minWidth: 100, textAlign: 'center' }}>
              {r.label}
            </span>
            <span style={{ fontSize: 12, color: C.muted }}>{r.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Members ───────────────────────────────────────────────
function MembersTab({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editType, setEditType] = useState('');
  const [editWallet, setEditWallet] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useApp();

  const load = async (p = 0, q = search) => {
    setLoading(true);
    try {
      const res = await adminGetUsers({ page: p, search: q });
      setUsers(res.data);
      setTotal(res.count);
      setPage(p);
    } catch(e) {
      console.warn('Users load failed:', e.message);
      toast('Could not load members. Check admin RLS policies.', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(0, ''); }, []);

  const handleSearch = (q) => {
    setSearch(q);
    const timer = setTimeout(() => load(0, q), 400);
    return () => clearTimeout(timer);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    
    // Protect official accounts and owners from modification
    if (selectedUser.account_type === 'official' || selectedUser.role === 'owner') {
      toast('Official accounts and owners cannot be modified', 'error');
      setSaving(false);
      return;
    }
    
    setSaving(true);
    try {
      const updates = {};
      if (editType) updates.account_type = editType;
      if (editWallet !== '') updates.wallet = parseInt(editWallet) || 0;
      await adminUpdateUser(selectedUser.id, updates);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...updates } : u));
      toast('Member updated ✓');
      setSelectedUser(null);
    } catch(e) {
      toast('Save failed — check permissions', 'error');
    } finally { setSaving(false); }
  };

  const handleSuspend = async (u) => {
    // Protect official accounts and owners from suspension
    if (u.account_type === 'official' || u.role === 'owner') {
      toast('Official accounts and owners cannot be suspended', 'error');
      return;
    }
    try {
      await adminUpdateUser(u.id, { account_type: 'suspended', wallet_frozen: true });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, account_type: 'suspended' } : x));
      toast(`${u.username} suspended`);
    } catch(e) { toast('Action failed', 'error'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
          <span style={{ color: C.muted }}>🔍</span>
          <input value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search members…"
            style={{ background: 'transparent', border: 'none', color: C.text, fontSize: 13, flex: 1, outline: 'none', fontFamily: 'inherit' }} />
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{total.toLocaleString()} total members</div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading…</div>}
        {!loading && users.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>No members found.</div>}
        {users.map(u => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${C.border}22`, cursor: 'pointer' }}
            onClick={() => { setSelectedUser(u); setEditType(u.account_type || 'resident'); setEditWallet(String(u.wallet || 0)); }}>
            <img src={u.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(u.username)}&backgroundColor=b6e3f4`}
              alt="" style={{ width: 38, height: 38, borderRadius: '18%', objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.display_name || u.username}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>@{u.username} · {timeAgo(u.created_at)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                background: `${ROLE_COLORS[u.account_type] || C.muted}22`,
                color: ROLE_COLORS[u.account_type] || C.muted,
                border: `1px solid ${ROLE_COLORS[u.account_type] || C.muted}44` }}>
                {u.account_type || 'resident'}
              </span>
              <span style={{ fontSize: 10, color: C.gold, fontWeight: 600 }}>L$ {(u.wallet || 0).toLocaleString()}</span>
            </div>
          </div>
        ))}
        {/* Pagination */}
        {total > 20 && (
          <div style={{ display: 'flex', gap: 8, padding: '12px 16px', justifyContent: 'center' }}>
            <button onClick={() => load(Math.max(0, page - 1))} disabled={page === 0}
              style={{ padding: '7px 16px', borderRadius: 10, background: page === 0 ? C.card2 : `${C.sky}22`, color: page === 0 ? C.muted : C.sky, fontWeight: 700, fontSize: 12, border: `1px solid ${page === 0 ? C.border : C.sky + '44'}` }}>
              ← Prev
            </button>
            <span style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center' }}>
              Page {page + 1} of {Math.ceil(total / 20)}
            </span>
            <button onClick={() => load(page + 1)} disabled={(page + 1) * 20 >= total}
              style={{ padding: '7px 16px', borderRadius: 10, background: (page + 1) * 20 >= total ? C.card2 : `${C.sky}22`, color: (page + 1) * 20 >= total ? C.muted : C.sky, fontWeight: 700, fontSize: 12, border: `1px solid ${(page + 1) * 20 >= total ? C.border : C.sky + '44'}` }}>
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Edit sheet */}
      {selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000bb', zIndex: 900, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setSelectedUser(null)}>
          <div style={{ background: C.card, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 20 }}
            className="fadeUp" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div className="sg" style={{ fontWeight: 700, fontSize: 16, color: C.text }}>Edit Member</div>
                <div style={{ fontSize: 12, color: C.muted }}>@{selectedUser.username}</div>
              </div>
              <button onClick={() => setSelectedUser(null)} style={{ color: C.muted, fontSize: 18 }}>✕</button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>ACCOUNT TYPE</label>
              <select 
                value={editType} 
                onChange={e => setEditType(e.target.value)} 
                disabled={selectedUser.account_type === 'official' || selectedUser.role === 'owner'}
                className="inp"
                style={{ 
                  opacity: (selectedUser.account_type === 'official' || selectedUser.role === 'owner') ? 0.5 : 1,
                  cursor: (selectedUser.account_type === 'official' || selectedUser.role === 'owner') ? 'not-allowed' : 'pointer'
                }}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {(selectedUser.account_type === 'official' || selectedUser.role === 'owner') && (
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                  🔒 Protected account - cannot be modified
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, letterSpacing: .5 }}>WALLET BALANCE (L$)</label>
              <input type="number" value={editWallet} onChange={e => setEditWallet(e.target.value)} className="inp" min="0" />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => { handleSuspend(selectedUser); setSelectedUser(null); }}
                disabled={selectedUser.account_type === 'official' || selectedUser.role === 'owner'}
                style={{ 
                  flex: 1, 
                  padding: '11px', 
                  borderRadius: 12, 
                  background: (selectedUser.account_type === 'official' || selectedUser.role === 'owner') ? C.card2 : '#ff446611', 
                  border: (selectedUser.account_type === 'official' || selectedUser.role === 'owner') ? `1px solid ${C.border}` : '1px solid #ff446633', 
                  color: (selectedUser.account_type === 'official' || selectedUser.role === 'owner') ? C.muted : '#ff6644', 
                  fontWeight: 700, 
                  fontSize: 13,
                  cursor: (selectedUser.account_type === 'official' || selectedUser.role === 'owner') ? 'not-allowed' : 'pointer',
                  opacity: (selectedUser.account_type === 'official' || selectedUser.role === 'owner') ? 0.5 : 1
                }}>
                ⏸️ {(selectedUser.account_type === 'official' || selectedUser.role === 'owner') ? 'Protected' : 'Suspend'}
              </button>
              <button onClick={handleSaveUser} disabled={saving}
                style={{ flex: 2, padding: '11px', borderRadius: 12, background: saving ? C.border : `linear-gradient(135deg,${C.sky},${C.peach})`, color: saving ? C.muted : '#060d14', fontWeight: 800, fontSize: 13 }}>
                {saving ? '⏳ Saving…' : 'Save Changes →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reports ───────────────────────────────────────────────
function ReportsTab({ currentUser: adminUser }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const { toast } = useApp();

  useEffect(() => {
    adminGetReports()
      .then(data => setReports(data))
      .catch(e => {
        console.warn('Reports failed:', e.message);
        toast('Could not load reports. Check admin RLS policies.', 'error');
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = reports.filter(r => filter === 'all' ? true : (r.status || 'pending') === filter);

  const handleAction = async (report, action) => {
    try {
      if (action === 'delete_post' && report.posts?.id) {
        await adminDeletePost(report.posts.id);
      }
      await adminResolveReport(report.id, action, adminUser.id);
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: 'resolved', action_taken: action } : r));
      toast(`Report resolved: ${action.replace(/_/g, ' ')}`);
    } catch(e) {
      toast('Action failed — check permissions', 'error');
    }
  };

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: 'flex', padding: '8px 16px', gap: 6, borderBottom: `1px solid ${C.border}` }}>
        {['pending', 'resolved', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: filter === f ? `${C.sky}22` : 'transparent',
              color: filter === f ? C.sky : C.muted,
              border: `1px solid ${filter === f ? C.sky + '44' : C.border}` }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading && <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading…</div>}
      {!loading && filtered.length === 0 && (
        <div style={{ padding: '50px 20px', textAlign: 'center', color: C.muted }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 13 }}>No {filter} reports.</div>
        </div>
      )}

      <div style={{ overflowY: 'auto' }}>
        {filtered.map(r => {
          const reporter = r.reporter;
          const post = r.posts;
          const isPending = (r.status || 'pending') === 'pending';
          return (
            <div key={r.id} style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}22`, opacity: isPending ? 1 : 0.6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: isPending ? '#ff446618' : `${C.green}18`,
                  color: isPending ? '#ff6644' : C.green,
                  border: `1px solid ${isPending ? '#ff446633' : C.green + '33'}`,
                  flexShrink: 0 }}>
                  {r.status || 'pending'}
                </span>
                <div style={{ fontSize: 12, color: C.muted, flex: 1 }}>
                  by <strong style={{ color: C.text }}>@{reporter?.username || '?'}</strong> · {timeAgo(r.created_at)}
                </div>
              </div>

              <div style={{ fontSize: 12, color: C.sky, fontWeight: 600, marginBottom: 6 }}>
                🚩 {r.reason}
              </div>

              {post && (
                <div style={{ padding: '8px 10px', background: C.card2, borderRadius: 10, marginBottom: 10, fontSize: 12, color: C.sub, lineHeight: 1.5 }}>
                  {post.image_url && <img src={post.image_url} alt="" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 6, display: 'block' }} />}
                  {post.caption || '(no caption)'}
                </div>
              )}

              {isPending && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => handleAction(r, 'dismissed')}
                    style={{ padding: '6px 12px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, color: C.muted, fontWeight: 700, fontSize: 11 }}>
                    ✓ Dismiss
                  </button>
                  {post && (
                    <button onClick={() => handleAction(r, 'delete_post')}
                      style={{ padding: '6px 12px', borderRadius: 10, background: '#ff446611', border: '1px solid #ff446633', color: '#ff6644', fontWeight: 700, fontSize: 11 }}>
                      🗑️ Delete Post
                    </button>
                  )}
                  <button onClick={() => handleAction(r, 'warned')}
                    style={{ padding: '6px 12px', borderRadius: 10, background: `${C.gold}11`, border: `1px solid ${C.gold}33`, color: C.gold, fontWeight: 700, fontSize: 11 }}>
                    ⚠️ Warn User
                  </button>
                </div>
              )}
              {!isPending && r.action_taken && (
                <div style={{ fontSize: 11, color: C.green }}>Action: {r.action_taken.replace(/_/g, ' ')}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Content ───────────────────────────────────────────────
function ContentTab() {
  const { toast } = useApp();
  const [prices, setPrices] = useState({ ad_price_basic: '250', ad_price_featured: '750', ad_price_premium: '1500' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    getAppContent()
      .then(content => {
        setPrices({
          ad_price_basic:    content.ad_price_basic    || '250',
          ad_price_featured: content.ad_price_featured || '750',
          ad_price_premium:  content.ad_price_premium  || '1500',
        });
      })
      .catch(e => console.warn('Content load failed:', e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSavePrice = async (key, value) => {
    setSaving(key);
    try {
      await adminUpdateAppContent(key, value);
      toast('Price updated ✓');
    } catch(e) {
      toast('Save failed — check permissions', 'error');
    } finally { setSaving(null); }
  };

  return (
    <div style={{ padding: '16px 16px 40px' }}>
      {/* Ad Prices */}
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>AD PRICES (L$)</div>
      {[
        { key: 'ad_price_basic',    label: '⚡ Basic',    color: C.sky,      desc: 'Highlighted in search & explore' },
        { key: 'ad_price_featured', label: '⭐ Featured', color: '#a78bfa',  desc: 'Featured card + injected in feed' },
        { key: 'ad_price_premium',  label: '👑 Premium',  color: C.gold,     desc: 'Top story + feed + explore banner' },
      ].map(tier => (
        <div key={tier.key} style={{ background: C.card, borderRadius: 14, padding: 14, marginBottom: 10, border: `1px solid ${tier.color}33` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: tier.color }}>{tier.label}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{tier.desc}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              value={prices[tier.key]}
              onChange={e => setPrices(prev => ({ ...prev, [tier.key]: e.target.value }))}
              className="inp"
              style={{ flex: 1 }}
              min="0"
            />
            <span style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>L$/week</span>
            <button
              onClick={() => handleSavePrice(tier.key, prices[tier.key])}
              disabled={saving === tier.key}
              style={{ padding: '8px 14px', borderRadius: 10, background: saving === tier.key ? C.border : `linear-gradient(135deg,${C.sky},${C.peach})`, color: saving === tier.key ? C.muted : '#060d14', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
              {saving === tier.key ? '⏳' : 'Save'}
            </button>
          </div>
        </div>
      ))}

      {/* Info */}
      <div style={{ marginTop: 20, padding: '12px 14px', background: `${C.sky}0a`, border: `1px solid ${C.sky}22`, borderRadius: 12, fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
        💡 Price changes take effect immediately for new ad purchases. Existing ads run at the price they were purchased at.<br /><br />
        Prices are the base per-week rate. Multi-group ads are multiplied by the group multiplier (1 group = ×1, 2 = ×1.8, 3 = ×2.5, 4+ = ×3).
      </div>

      <div style={{ marginTop: 20, padding: '12px 14px', background: `${C.gold}0a`, border: `1px solid ${C.gold}22`, borderRadius: 12, fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
        📝 To edit Terms & Conditions or FAQ content, update the <strong style={{ color: C.text }}>tcData.js</strong> and <strong style={{ color: C.text }}>qaData.js</strong> files directly and redeploy. A full CMS editor is coming in a future update.
      </div>
    </div>
  );
}

// ── Events ────────────────────────────────────────────────
function EventsTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useApp();

  useEffect(() => {
    adminGetAllEvents()
      .then(setEvents)
      .catch(e => console.warn('Events load failed:', e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (eventId, title) => {
    if (!window.confirm(`Delete event: "${title}"?`)) return;
    try {
      await adminDeleteEvent(eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
      toast('Event deleted');
    } catch(e) {
      toast('Delete failed — check permissions', 'error');
    }
  };

  return (
    <div>
      <div style={{ padding: '10px 16px 6px', fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>
        ALL EVENTS ({events.length})
      </div>
      {loading && <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading…</div>}
      {!loading && events.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>No events yet.</div>}
      <div style={{ overflowY: 'auto' }}>
        {events.map(ev => {
          const host = ev.profiles?.display_name || ev.profiles?.username || 'Unknown';
          const dateStr = ev.date ? new Date(ev.date + 'T00:00:00').toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : null;
          return (
            <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${C.border}22` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 2 }}>{ev.title}</div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  @{host}
                  {dateStr ? ` · ${dateStr}` : ''}
                  {ev.time_slt ? ` · ${ev.time_slt} SLT` : ''}
                </div>
                {ev.location_name && <div style={{ fontSize: 11, color: C.sub, marginTop: 1 }}>📍 {ev.location_name}</div>}
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 10, color: C.muted, padding: '2px 6px', background: C.card2, borderRadius: 20, border: `1px solid ${C.border}` }}>
                  {timeAgo(ev.created_at)}
                </span>
                <button onClick={() => handleDelete(ev.id, ev.title)}
                  style={{ padding: '3px 8px', borderRadius: 20, background: '#ff446611', border: '1px solid #ff446633', color: '#ff6644', fontWeight: 700, fontSize: 10 }}>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main AdminScreen ──────────────────────────────────────
export default function AdminScreen({ onClose }) {
  const { currentUser } = useApp();
  const [activeTab, setActiveTab] = useState('overview');

  const ADMIN_TYPES = ['admin', 'super_admin', 'moderator', 'support', 'finance', 'content_editor'];
  const isAdmin = ADMIN_TYPES.includes(currentUser.accountType);

  if (!isAdmin) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 900, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', maxWidth: 480, margin: '0 auto', padding: 20 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
        <div className="sg" style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 8 }}>Access Denied</div>
        <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 20 }}>You don't have permission to access the admin panel.</div>
        <button onClick={onClose} style={{ padding: '11px 24px', borderRadius: 14, background: C.card2, border: `1px solid ${C.border}`, color: C.text, fontWeight: 700 }}>← Back</button>
      </div>
    );
  }

  // Role-based tab visibility
  const roleAccess = {
    super_admin:     ['overview', 'members', 'reports', 'content', 'events'],
    admin:           ['overview', 'members', 'reports', 'content', 'events'],
    moderator:       ['overview', 'members', 'reports', 'events'],
    support:         ['overview', 'reports'],
    finance:         ['overview', 'members'],
    content_editor:  ['overview', 'content'],
  };
  const allowed = roleAccess[currentUser.accountType] || ['overview'];
  const visibleTabs = TABS.filter(t => allowed.includes(t.id));

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 900, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }} className="fadeUp">

      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={{ color: C.text, fontSize: 22, fontWeight: 300 }}>←</button>
        <div style={{ flex: 1 }}>
          <div className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Admin Panel</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>
            <span style={{ color: ROLE_COLORS[currentUser.accountType] || C.muted, fontWeight: 700 }}>
              {currentUser.accountType?.replace(/_/g, ' ')}
            </span>
            <span style={{ color: C.muted }}> · {currentUser.username}</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.muted, padding: '3px 8px', background: `${C.sky}11`, border: `1px solid ${C.sky}22`, borderRadius: 20 }}>
          {new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: C.card, borderBottom: `1px solid ${C.border}`, flexShrink: 0, overflowX: 'auto' }}>
        {visibleTabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ flex: '0 0 auto', padding: '11px 14px', fontSize: 11, fontWeight: 700,
              color: activeTab === t.id ? C.sky : C.muted,
              borderBottom: `2px solid ${activeTab === t.id ? C.sky : 'transparent'}`,
              whiteSpace: 'nowrap', transition: 'all .15s' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'members'  && <MembersTab  currentUser={currentUser} />}
        {activeTab === 'reports'  && <ReportsTab  currentUser={currentUser} />}
        {activeTab === 'content'  && <ContentTab  />}
        {activeTab === 'events'   && <EventsTab   />}
      </div>
    </div>
  );
}
