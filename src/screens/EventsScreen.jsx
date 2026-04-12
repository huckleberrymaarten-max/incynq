import { useState } from 'react';
import C from '../theme';
import { INIT_EVENTS, EVENT_BOOST_TIERS } from '../data';

export default function EventsScreen() {
  const [events] = useState(INIT_EVENTS);
  const [rsvped, setRsvped] = useState(new Set([1]));
  const [interested, setInterested] = useState(new Set([3]));
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text }}>Events</span>
        <button onClick={() => setShowCreate(true)} style={{ background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 800, fontSize: 12, padding: '7px 14px', borderRadius: 20 }}>+ Create</button>
      </div>

      {/* Events list */}
      <div style={{ padding: '12px 16px 80px' }}>
        {events.map(ev => {
          const boostColor = EVENT_BOOST_TIERS.find(t => t.id === ev.boosted)?.color || C.gold;
          const isRsvp = rsvped.has(ev.id);
          const isInterested = interested.has(ev.id);
          return (
            <div key={ev.id} style={{ background: C.card, borderRadius: 16, overflow: 'hidden', marginBottom: 12, border: `1px solid ${ev.boosted ? boostColor + '44' : C.border}` }}>
              {ev.image && <img src={ev.image} alt="" style={{ width: '100%', height: 140, objectFit: 'cover' }} />}
              <div style={{ padding: 14 }}>
                {ev.boosted && (
                  <div style={{ fontSize: 10, color: boostColor, fontWeight: 700, marginBottom: 6 }}>⚡ FEATURED EVENT</div>
                )}
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 4 }}>{ev.title}</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>📅 {ev.date} · {ev.time} · @{ev.host}</div>
                <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 12 }}>{ev.desc}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { const n = new Set(rsvped); n.has(ev.id) ? n.delete(ev.id) : n.add(ev.id); setRsvped(n); }}
                    style={{ flex: 1, padding: '9px', borderRadius: 10, fontWeight: 700, fontSize: 13, background: isRsvp ? `${C.sky}22` : C.card2, border: `1.5px solid ${isRsvp ? C.sky : C.border}`, color: isRsvp ? C.sky : C.sub }}>
                    {isRsvp ? '✓ Going' : 'RSVP'}
                  </button>
                  <button
                    onClick={() => { const n = new Set(interested); n.has(ev.id) ? n.delete(ev.id) : n.add(ev.id); setInterested(n); }}
                    style={{ flex: 1, padding: '9px', borderRadius: 10, fontWeight: 700, fontSize: 13, background: isInterested ? `${C.gold}18` : C.card2, border: `1.5px solid ${isInterested ? C.gold : C.border}`, color: isInterested ? C.gold : C.sub }}>
                    {isInterested ? '★ Interested' : 'Interested'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: C.muted }}>
                  <span>👥 {ev.rsvps} going</span>
                  <span>⭐ {ev.interested} interested</span>
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
              {[['EVENT TITLE', 'e.g. ★ DJ Night at Neon Lounge ★'], ['LOCATION / SIM NAME', 'e.g. Neon District'], ['SLURL', 'secondlife://...']].map(([label, ph]) => (
                <div key={label}>
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: .5 }}>{label}</label>
                  <input placeholder={ph} className="inp" />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: .5 }}>DATE</label>
                  <input type="date" className="inp" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: .5 }}>TIME (SLT)</label>
                  <input placeholder="20:00" className="inp" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: .5 }}>DESCRIPTION</label>
                <textarea placeholder="Tell people what's happening..." className="inp" style={{ height: 75 }} />
              </div>
              <button onClick={() => setShowCreate(false)} style={{ width: '100%', background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 900, fontSize: 14, padding: '13px', borderRadius: 14 }}>Post Event →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
