import { useState, useEffect } from 'react';
import C from '../theme';
import { useContent } from '../context/ContentContext';
import { useApp } from '../context/AppContext';
import { getEvents, createEvent, getEventRsvps, upsertRsvp, removeRsvp } from '../lib/db';

export default function EventsScreen() {
  const { currentUser, toast } = useApp();
  const { eventBoostTiers } = useContent();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rsvped, setRsvped] = useState(new Set());      // event IDs where status = 'going'
  const [interested, setInterested] = useState(new Set()); // event IDs where status = 'interested'
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [title, setTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [slurl, setSlurl] = useState('');
  const [date, setDate] = useState('');
  const [timeSlt, setTimeSlt] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Load events + user RSVPs ──────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [evData, rsvpData] = await Promise.all([
          getEvents(),
          currentUser?.id ? getEventRsvps(currentUser.id) : Promise.resolve([]),
        ]);
        setEvents(evData || []);
        const going = new Set();
        const int   = new Set();
        (rsvpData || []).forEach(r => {
          if (r.status === 'going')      going.add(r.event_id);
          if (r.status === 'interested') int.add(r.event_id);
        });
        setRsvped(going);
        setInterested(int);
      } catch (e) {
        console.warn('Could not load events:', e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── RSVP helpers ─────────────────────────────────────────
  const handleRsvp = async (eventId) => {
    if (!currentUser?.id) return;
    const isGoing = rsvped.has(eventId);
    const n = new Set(rsvped);

    if (isGoing) {
      n.delete(eventId);
      setRsvped(n);
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, rsvp_count: Math.max(0, (e.rsvp_count || 0) - 1) } : e));
      try { await removeRsvp(currentUser.id, eventId); } catch (e) { console.warn('RSVP remove failed:', e.message); }
    } else {
      n.add(eventId);
      // Remove from interested if switching
      const ni = new Set(interested);
      ni.delete(eventId);
      setRsvped(n);
      setInterested(ni);
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, rsvp_count: (e.rsvp_count || 0) + 1 } : e));
      try { await upsertRsvp(currentUser.id, eventId, 'going'); } catch (e) { console.warn('RSVP failed:', e.message); }
    }
  };

  const handleInterested = async (eventId) => {
    if (!currentUser?.id) return;
    const isInterested = interested.has(eventId);
    const n = new Set(interested);

    if (isInterested) {
      n.delete(eventId);
      setInterested(n);
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, interested_count: Math.max(0, (e.interested_count || 0) - 1) } : e));
      try { await removeRsvp(currentUser.id, eventId); } catch (e) { console.warn('Interest remove failed:', e.message); }
    } else {
      n.add(eventId);
      // Remove from going if switching
      const nr = new Set(rsvped);
      nr.delete(eventId);
      setInterested(n);
      setRsvped(nr);
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, interested_count: (e.interested_count || 0) + 1 } : e));
      try { await upsertRsvp(currentUser.id, eventId, 'interested'); } catch (e) { console.warn('Interest failed:', e.message); }
    }
  };

  // ── Create event ─────────────────────────────────────────
  const handleCreate = async () => {
    if (!title.trim()) { toast('Give your event a title', 'error'); return; }
    setSaving(true);
    try {
      const newEvent = await createEvent({
        userId:       currentUser.id,
        title:        title.trim(),
        locationName: locationName.trim(),
        slurl:        slurl.trim(),
        date:         date || null,
        timeSlt:      timeSlt.trim(),
        description:  description.trim(),
      });
      setEvents(prev => [newEvent, ...prev]);
      toast('Event posted! ✓');
      setShowCreate(false);
      // Reset form
      setTitle(''); setLocationName(''); setSlurl('');
      setDate(''); setTimeSlt(''); setDescription('');
    } catch (e) {
      toast('Could not post event — please try again', 'error');
      console.warn('Create event failed:', e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Events</span>
        <button onClick={() => setShowCreate(true)} style={{ background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 800, fontSize: 12, padding: '7px 14px', borderRadius: 20 }}>+ Create</button>
      </div>

      {/* Events list */}
      <div style={{ padding: '12px 16px 80px' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
            <div style={{ fontSize: 28, marginBottom: 10, animation: 'pulse 1.5s infinite' }}>🎉</div>
            <div style={{ fontSize: 13 }}>Loading events…</div>
          </div>
        )}

        {!loading && events.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6 }}>No events yet</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>Be the first to post one — it is free for everyone.</div>
            <button onClick={() => setShowCreate(true)}
              style={{ marginTop: 16, padding: '10px 24px', borderRadius: 20, background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 800, fontSize: 13 }}>
              + Post an event
            </button>
          </div>
        )}

        {events.map(ev => {
          const boostColor = eventBoostTiers.find(t => t.id === ev.boost_tier)?.color || C.gold;
          const isRsvp     = rsvped.has(ev.id);
          const isInt      = interested.has(ev.id);
          const host       = ev.profiles?.display_name || ev.profiles?.username || 'Unknown';
          const dateStr    = ev.date ? new Date(ev.date + 'T00:00:00').toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' }) : null;

          return (
            <div key={ev.id} style={{ background: C.card, borderRadius: 16, overflow: 'hidden', marginBottom: 12, border: `1px solid ${ev.boost_tier ? boostColor + '44' : C.border}` }}>
              {ev.image_url && <img src={ev.image_url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover' }} />}
              <div style={{ padding: 14 }}>
                {ev.boost_tier && (
                  <div style={{ fontSize: 10, color: boostColor, fontWeight: 700, marginBottom: 6 }}>⚡ FEATURED EVENT</div>
                )}
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 4 }}>{ev.title}</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>
                  {dateStr && <span>📅 {dateStr}{ev.time_slt ? ` · ${ev.time_slt} SLT` : ''} · </span>}
                  <span>@{host}</span>
                </div>
                {ev.location_name && (
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>📍 {ev.location_name}</div>
                )}
                {ev.description && (
                  <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 12 }}>{ev.description}</div>
                )}
                {ev.slurl && (
                  <div style={{ fontSize: 11, color: C.sky, marginBottom: 12, fontWeight: 600 }}>🔗 {ev.slurl}</div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleRsvp(ev.id)}
                    style={{ flex: 1, padding: '9px', borderRadius: 10, fontWeight: 700, fontSize: 13, background: isRsvp ? `${C.sky}22` : C.card2, border: `1.5px solid ${isRsvp ? C.sky : C.border}`, color: isRsvp ? C.sky : C.sub }}>
                    {isRsvp ? '✓ Going' : 'RSVP'}
                  </button>
                  <button
                    onClick={() => handleInterested(ev.id)}
                    style={{ flex: 1, padding: '9px', borderRadius: 10, fontWeight: 700, fontSize: 13, background: isInt ? `${C.gold}18` : C.card2, border: `1.5px solid ${isInt ? C.gold : C.border}`, color: isInt ? C.gold : C.sub }}>
                    {isInt ? '★ Interested' : 'Interested'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: C.muted }}>
                  <span>👥 {ev.rsvp_count || 0} going</span>
                  <span>⭐ {ev.interested_count || 0} interested</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create event modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000bb', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.card, borderRadius: 20, width: '100%', maxWidth: 440, overflow: 'hidden', maxHeight: '88vh', overflowY: 'auto' }} className="fadeUp">
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
              <span className="sg" style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Create Event</span>
              <button onClick={() => setShowCreate(false)} style={{ color: C.muted, fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '8px 12px', background: `${C.sky}11`, border: `1px solid ${C.sky}33`, borderRadius: 10, fontSize: 11, color: C.sky, lineHeight: 1.5 }}>
                ✅ Posting events is <strong>free</strong> for everyone.
              </div>

              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: .5 }}>EVENT TITLE *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. ★ DJ Night at Neon Lounge ★" className="inp" />
              </div>

              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: .5 }}>LOCATION / SIM NAME</label>
                <input value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="e.g. Neon District" className="inp" />
              </div>

              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: .5 }}>SLURL</label>
                <input value={slurl} onChange={e => setSlurl(e.target.value)} placeholder="secondlife://..." className="inp" />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: .5 }}>DATE</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="inp" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: .5 }}>TIME (SLT)</label>
                  <input value={timeSlt} onChange={e => setTimeSlt(e.target.value)} placeholder="20:00" className="inp" />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: .5 }}>DESCRIPTION</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell people what's happening..." className="inp" style={{ height: 75 }} />
              </div>

              <button
                onClick={handleCreate}
                disabled={saving || !title.trim()}
                style={{ width: '100%', background: saving || !title.trim() ? C.border : `linear-gradient(135deg,${C.sky},${C.peach})`, color: saving || !title.trim() ? C.muted : '#060d14', fontWeight: 900, fontSize: 14, padding: '13px', borderRadius: 14 }}>
                {saving ? '⏳ Posting…' : 'Post Event →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
