import { useState, useEffect } from 'react';
import C from '../theme';
import { useContent } from '../context/ContentContext';
import { useApp } from '../context/AppContext';
import { getEvents, createEvent, updateEvent, deleteEvent, getEventRsvps, upsertRsvp, removeRsvp, uploadPostImage, createReport, goLive, endSet, sweepLiveSessions, getLiveAll, followUser, unfollowUser, performerHeartbeat, getLiveSettings } from '../lib/db';
import ImageCropModal from '../components/ImageCropModal';

export default function EventsScreen({ onPlayLive, onStopLive, nowPlayingEventId }) {
  const { currentUser, toast } = useApp();

  // Acting as a DJ / live performer? Only a performer identity can flag a live
  // set or go live, and the gig is attributed to that identity.
  const activePerformer = currentUser?.performerMode
    ? (currentUser.ownedBrands || []).find(b => b.id === currentUser.activePerformerId)
    : null;
  const { eventBoostTiers } = useContent();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rsvped, setRsvped] = useState(new Set());      // event IDs where status = 'going'
  const [interested, setInterested] = useState(new Set()); // event IDs where status = 'interested'
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);  // event being edited
  const [menuOpenId, setMenuOpenId] = useState(null);       // ⋯ menu open for which event

  // Create form state
  const [title, setTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [slurl, setSlurl] = useState('');
  const [date, setDate] = useState('');
  const [timeSlt, setTimeSlt] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [isLiveSet, setIsLiveSet] = useState(false);
  const [streamUrl, setStreamUrl] = useState('');
  const [goingLive, setGoingLive] = useState(null);   // event id mid-request
  // Everyone on air, followed first. Events is the DISCOVERY surface: anyone can
  // find a live gig here and follow the DJ, which is what graduates them into
  // that resident's feed strip.
  const [liveNow, setLiveNow] = useState([]);
  const [followBusy, setFollowBusy] = useState(null);
  // Listener counts, keyed by session id. Only fetched for the performer's own
  // live set — a DJ needs to know who's in the room; other people don't.
  const [listeners, setListeners] = useState({});
  const [eventImageUrl, setEventImageUrl] = useState('');
  const [eventImageFile, setEventImageFile] = useState(null);
  const [eventCropFile, setEventCropFile] = useState(null);
  const [uploadingEventImage, setUploadingEventImage] = useState(false);

  // ── Load events + user RSVPs ──────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [evData, rsvpData] = await Promise.all([
          sweepLiveSessions().then(getEvents),
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

  // ── Edit event ────────────────────────────────────────────
  const handleEdit = (ev) => {
    setMenuOpenId(null);
    setTitle(ev.title || '');
    setLocationName(ev.location_name || '');
    setSlurl(ev.slurl || '');
    setDate(ev.date || '');
    setTimeSlt(ev.time_slt || '');
    setDescription(ev.description || '');
    setEventImageUrl(ev.image_url || '');
    setEventImageFile(null);
    setIsLiveSet(!!ev.is_live_set);
    setStreamUrl(ev.stream_url || '');
    setEditingEvent(ev);
    setShowCreate(true);
  };

  // Live list refresh — cheap, and keeps the pinned section honest.
  const refreshLive = async () => {
    try { setLiveNow(await getLiveAll()); } catch (e) { console.warn('Live list failed:', e.message); }
  };

  useEffect(() => {
    refreshLive();
    const t = setInterval(refreshLive, 60000);
    return () => clearInterval(t);
  }, []);

  // Poll the listener count for the performer's OWN live set, every 20s.
  //
  // Reads the session id straight off the event the performer is looking at,
  // rather than going via the liveNow list. That earlier version silently did
  // nothing whenever liveNow was empty — including when its RPC didn't exist —
  // so the count sat at 0 with no clue why. The card already knows its own
  // session; use that.
  // Session id comes from liveNow now that a live event is no longer rendered
  // in the list below, falling back to the event itself.
  const myLiveSessionId = activePerformer
    ? (liveNow.find(l => l.performer_id === activePerformer.id)?.session_id
       || events.find(e => e.performer_id === activePerformer.id && e.live_session_id)?.live_session_id
       || null)
    : null;

  // The performer's heartbeat. Does double duty: it keeps the session alive AND
  // returns the listener count, so this is one call rather than two.
  //
  // Without it, a dropped connection would leave the session running and the DJ
  // would be billed for airtime they never used — settling on elapsed time
  // can't tell "still broadcasting" from "browser gone" on its own.
  useEffect(() => {
    if (!myLiveSessionId) return;
    let alive = true;
    const beat = async () => {
      try {
        const res = await performerHeartbeat(myLiveSessionId);
        if (alive) setListeners(prev => ({ ...prev, [myLiveSessionId]: res.listeners ?? 0 }));
      } catch (e) {
        if (!alive) return;
        // The session ended underneath us — capped, swept, or ended elsewhere.
        if (e.ended) {
          // Most likely the heartbeat lapsed. Say what to do about it, rather
          // than leaving the DJ wondering whether the gig is gone.
          toast('Your set ended — tap Go Live to start again');
          setEvents(await getEvents());
          await refreshLive();
        }
      }
    };
    beat();
    const t = setInterval(beat, 30000);
    // Coming back to the tab should re-establish presence immediately rather
    // than waiting out the interval.
    const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [myLiveSessionId]);

  // Admin-set: how long the browser may go quiet before the session is ended.
  const [graceMins, setGraceMins] = useState(10);
  useEffect(() => {
    getLiveSettings().then(s => setGraceMins(s.grace_minutes || 10)).catch(() => {});
  }, []);

  const toggleFollow = async (performerId) => {
    if (!currentUser?.id || followBusy) return;
    setFollowBusy(performerId);
    const row = liveNow.find(l => l.performer_id === performerId);
    try {
      if (row?.is_following) await unfollowUser(currentUser.id, performerId);
      else                   await followUser(currentUser.id, performerId);
      await refreshLive();
    } catch (e) { toast(e.message || 'Could not update follow', 'error'); }
    finally { setFollowBusy(null); }
  };

  // ── Go live / end set ─────────────────────────────────────
  // Airtime is a balance, not a booking: the clock starts now and only the
  // minutes actually broadcast are charged, settled when the set ends. The
  // session is capped at the hours held, so nobody broadcasts past their
  // balance — the cap is a safety limit, not a purchase.
  const handleGoLive = async (ev) => {
    setGoingLive(ev.id);
    try {
      const res = await goLive(ev.id);
      const ends = new Date(res.auto_end_at);
      toast(`You're live! Airtime is running — set ends by ${ends.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} unless you end it sooner`);
      setEvents(await getEvents());
      await refreshLive();
      if (onPlayLive) onPlayLive(ev);
    } catch (e) {
      toast(e.message || 'Could not go live', 'error');
    } finally { setGoingLive(null); }
  };

  const handleEndSet = async (ev) => {
    if (!confirm('End your set? Airtime stops being charged now.')) return;
    setGoingLive(ev.id);
    try {
      const res = await endSet(ev.live_session_id);
      toast(res.total_listeners
        ? `Set ended — ${res.minutes_consumed} min of airtime, ${res.total_listeners} listener${res.total_listeners === 1 ? '' : 's'}`
        : `Set ended — ${res.minutes_consumed} min of airtime used`);
      setEvents(await getEvents());
      await refreshLive();
      if (onStopLive) onStopLive();
    } catch (e) {
      toast(e.message || 'Could not end the set', 'error');
    } finally { setGoingLive(null); }
  };

  // ── Delete event ──────────────────────────────────────────
  const handleDelete = async (ev) => {
    setMenuOpenId(null);
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    try {
      await deleteEvent(ev.id);
      setEvents(prev => prev.filter(e => e.id !== ev.id));
      toast('Event deleted');
    } catch (e) {
      toast('Could not delete event', 'error');
    }
  };

  // ── Flag event ────────────────────────────────────────────
  const handleFlag = async (ev) => {
    try {
      await createReport({ reporterId: currentUser.id, eventId: ev.id, reason: 'Flagged by user' });
      toast('Event reported — thank you');
    } catch (e) {
      toast('Could not report event', 'error');
    }
  };

  // ── Create OR update event ────────────────────────────────
  const handleCreate = async () => {
    if (!title.trim()) { toast('Give your event a title', 'error'); return; }
    // Date is required: an event without one can't be sorted, never expires,
    // and tells nobody when to turn up.
    if (!date) { toast('Pick a date for your event', 'error'); return; }
    setSaving(true);
    try {
      let uploadedImageUrl = null;
      if (eventImageFile) {
        try { uploadedImageUrl = await uploadPostImage(currentUser.id, eventImageFile); }
        catch (e) { uploadedImageUrl = eventImageUrl; }
      }

      // A live set must carry a stream — the DB enforces this too.
      if (isLiveSet && !streamUrl.trim()) {
        toast('Add your stream URL for a live set', 'error');
        setSaving(false);
        return;
      }

      const payload = {
        userId: currentUser.id,
        performerId: activePerformer?.id || null,
        isLiveSet:   !!activePerformer && isLiveSet,
        streamUrl:   streamUrl.trim(),
        title: title.trim(),
        locationName: locationName.trim(),
        slurl: slurl.trim(),
        date: date || null,
        timeSlt: timeSlt.trim(),
        description: description.trim(),
        imageUrl: uploadedImageUrl || eventImageUrl || null,
      };

      if (editingEvent) {
        // Update existing event
        const updated = await updateEvent(editingEvent.id, payload);
        setEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...e, ...updated } : e));
        toast('Event updated ✓');
      } else {
        // Create new event
        const newEvent = await createEvent(payload);
        setEvents(prev => [newEvent, ...prev]);
        toast('Event posted! ✓');
      }

      setShowCreate(false);
      setEditingEvent(null);
      setTitle(''); setLocationName(''); setSlurl('');
      setDate(''); setTimeSlt(''); setDescription('');
      setEventImageUrl(''); setEventImageFile(null);
      setIsLiveSet(false); setStreamUrl('');
    } catch (e) {
      toast('Could not save event — please try again', 'error');
      console.warn('Save event failed:', e.message);
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
        <button onClick={() => setShowCreate(true)} style={{ background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 800, fontSize: 12, padding: '7px 14px', borderRadius: 20 }}>+ Create event</button>
      </div>

      {/* Events list */}
      <div style={{ padding: '12px 16px 80px' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
            <div style={{ fontSize: 28, marginBottom: 10, animation: 'pulse 1.5s infinite' }}>🎉</div>
            <div style={{ fontSize: 13 }}>Loading events…</div>
          </div>
        )}

        {/* ── Live now — pinned above the list ──
            A gig happening RIGHT NOW is a different proposition from an event
            next Tuesday, so it doesn't belong sorted by date among them. This
            is also the discovery surface: anyone can listen, and follow the DJ
            to get them in their own feed strip next time. */}
        {liveNow.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#ff6680', letterSpacing: 1, marginBottom: 10 }}>
              🔴 LIVE NOW
            </div>
            {liveNow.map(l => {
              const playing = nowPlayingEventId === l.event_id;
              const mine    = activePerformer && l.performer_id === activePerformer.id;
              return (
                <div key={l.session_id} style={{ background: C.card, border: '1px solid #ff446644', borderRadius: 16, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 10 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 13, overflow: 'hidden', background: `${C.sky}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {l.brand_logo_url
                        ? <img src={l.brand_logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 20 }}>🎧</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{l.brand_name}</div>
                      <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
                    </div>
                    {!mine && currentUser?.id && (
                      <button onClick={() => toggleFollow(l.performer_id)} disabled={followBusy === l.performer_id}
                        style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: l.is_following ? 'transparent' : `linear-gradient(135deg,${C.sky},${C.peach})`,
                          color: l.is_following ? C.sky : '#060d14',
                          border: l.is_following ? `1px solid ${C.sky}44` : 'none', cursor: 'pointer' }}>
                        {l.is_following ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                  {(() => {
                    const ev = events.find(e => e.id === l.event_id);
                    return ev?.description ? (
                      <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.5, marginBottom: 10 }}>{ev.description}</div>
                    ) : null;
                  })()}

                  {/* The performer's own controls live here now, since their
                      event is no longer rendered in the list below. */}
                  {mine && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, padding: '8px 12px', background: C.card2, borderRadius: 10 }}>
                        <span style={{ fontSize: 15 }}>👂</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: C.sky }}>{listeners[l.session_id] ?? 0}</span>
                        <span style={{ fontSize: 12, color: C.muted }}>listening right now</span>
                      </div>
                      <button onClick={() => handleEndSet({ id: l.event_id, live_session_id: l.session_id })}
                        disabled={goingLive === l.event_id}
                        style={{ width: '100%', padding: '10px', borderRadius: 12, marginBottom: 8,
                          background: 'transparent', border: '1px solid #ff446666',
                          color: '#ff6680', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                        {goingLive === l.event_id ? 'Ending…' : '⏹ End set'}
                      </button>
                      <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.5, marginBottom: 8 }}>
                        Keep InCynq open while you're live — it's how we know you're still on
                        air. Lose connection for more than {graceMins} minutes and your set
                        ends on its own. You're only charged for the time you were actually
                        on, and your gig stays right here — just tap Go Live again.
                      </div>
                    </>
                  )}

                  <button onClick={() => playing ? onStopLive && onStopLive() : onPlayLive && onPlayLive({ id: l.event_id, live_session_id: l.session_id, title: l.title, performer: { brand_name: l.brand_name, brand_handle: l.brand_handle } })}
                    style={{ width: '100%', padding: '10px', borderRadius: 12, border: 'none',
                      background: playing ? C.card2 : `linear-gradient(135deg,${C.sky},${C.peach})`,
                      color: playing ? C.sky : '#060d14', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                    {playing ? '⏸ Stop listening' : '🎧 Listen live'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!loading && events.length === 0 && liveNow.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6 }}>No events yet</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>Be the first to post one — it is free for everyone.</div>
            <button onClick={() => setShowCreate(true)}
              style={{ marginTop: 16, padding: '10px 24px', borderRadius: 20, background: `linear-gradient(135deg,${C.sky},${C.peach})`, color: '#060d14', fontWeight: 800, fontSize: 13 }}>
              + Create an event
            </button>
          </div>
        )}

        {/* Anything currently live is pinned above, so it's excluded here —
            otherwise the same gig appears twice. The pin is "on now", this list
            is "coming up". */}
        {events.filter(ev => !ev.live_session_id).map(ev => {
          const boostColor = eventBoostTiers.find(t => t.id === ev.boost_tier)?.color || C.gold;
          const isRsvp     = rsvped.has(ev.id);
          const isInt      = interested.has(ev.id);
          // A gig is hosted by the performer identity, not the human who created
          // it. user_id stays the accountable human; performer_id is who it
          // appears AS — same split posts use with brand_id.
          const host       = ev.performer
            ? (ev.performer.brand_handle || ev.performer.brand_name)
            : (ev.profiles?.display_name || ev.profiles?.username || 'Unknown');
          const dateStr    = ev.date ? new Date(ev.date + 'T00:00:00').toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' }) : null;
          
          // Format SLT time and convert to the viewer's local time.
          //
          // The stored value IS Second Life Time (America/Los_Angeles).
          //
          // Two ways to get this wrong, both of which we did:
          //   1. `new Date(date + 'T' + time)` builds that wall time in the
          //      VIEWER's zone, then asks what instant it is in LA — backwards.
          //   2. Correcting that via `new Date(someDate.toLocaleString(...))`
          //      re-parses a localised string in the viewer's zone, so the
          //      offset came out an hour wrong from Dublin while testing fine
          //      in UTC.
          //
          // This never parses a localised string: it reads LA's wall-clock
          // parts for a guessed instant, rebuilds them as UTC to measure the
          // real offset on that date (DST included), and shifts by it.
          const sltTime    = ev.time_slt ? ev.time_slt.replace('.', ':') : null;
          let localTimeStr = null;
          if (ev.date && sltTime) {
            try {
              const hhmm = sltTime.padStart(5, '0');
              const guess = new Date(`${ev.date}T${hhmm}:00Z`);

              const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Los_Angeles', hour12: false,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              }).formatToParts(guess).reduce((a, x) => { a[x.type] = x.value; return a; }, {});

              const laAsUTC  = Date.UTC(+parts.year, +parts.month - 1, +parts.day,
                                        (+parts.hour) % 24, +parts.minute, +parts.second);
              const instant  = new Date(guess.getTime() - (laAsUTC - guess.getTime()));

              const localTz  = Intl.DateTimeFormat().resolvedOptions().timeZone;
              const localStr = instant.toLocaleTimeString('en-GB', { timeZone: localTz, hour: '2-digit', minute: '2-digit', hour12: false });
              const tzAbbr   = new Intl.DateTimeFormat('en', { timeZoneName: 'short', timeZone: localTz })
                                 .formatToParts(instant).find(x => x.type === 'timeZoneName')?.value || '';
              // Only worth showing when it differs from the SLT value.
              if (localStr !== hhmm) localTimeStr = `${localStr} ${tzAbbr}`;
            } catch {}
          }

          const isOwner = currentUser?.id && (
            ev.user_id === currentUser.id ||
            ev.profiles?.id === currentUser.id ||
            (activePerformer && ev.performer_id === activePerformer.id)
          );

          return (
            <div key={ev.id} style={{ background: C.card, borderRadius: 16, overflow: 'hidden', marginBottom: 12, border: `1px solid ${ev.boost_tier ? boostColor + '44' : C.border}` }}>
              {ev.image_url && <img src={ev.image_url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover' }} />}
              <div style={{ padding: 14 }}>
                {ev.boost_tier && (
                  <div style={{ fontSize: 10, color: boostColor, fontWeight: 700, marginBottom: 6 }}>⚡ FEATURED EVENT</div>
                )}
                {ev.live_session_id ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#ff446618', border: '1px solid #ff446644', borderRadius: 8, padding: '3px 9px', marginBottom: 8 }}>
                    <span style={{ fontSize: 10 }}>🔴</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#ff6680', letterSpacing: 0.5 }}>LIVE NOW</span>
                  </div>
                ) : ev.last_ended_at ? (
                  /* States a fact — the last session is over — without claiming
                     the DJ is finished for good. A dropped set and a deliberate
                     one look identical, so we don't guess: Go Live stays
                     available and tapping it just starts again. */
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '3px 9px', marginBottom: 8 }}>
                    <span style={{ fontSize: 10 }}>⏹</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: C.muted, letterSpacing: 0.5 }}>
                      SET ENDED {new Date(ev.last_ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ) : ev.is_live_set && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${C.sky}18`, border: `1px solid ${C.sky}44`, borderRadius: 8, padding: '3px 9px', marginBottom: 8 }}>
                    <span style={{ fontSize: 10 }}>🎧</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: C.sky, letterSpacing: 0.5 }}>LIVE SET</span>
                  </div>
                )}

                {/* Title row with action button */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.text, flex: 1, paddingRight: 8 }}>{ev.title}</div>
                  {isOwner ? (
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button onClick={() => setMenuOpenId(menuOpenId === ev.id ? null : ev.id)}
                        style={{ color: C.muted, fontSize: 18, padding: '0 4px', lineHeight: 1 }}>⋯</button>
                      {menuOpenId === ev.id && (
                        <div style={{ position: 'absolute', right: 0, top: 24, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, zIndex: 100, minWidth: 130, boxShadow: '0 4px 20px #00000066' }}>
                          <button onClick={() => handleEdit(ev)}
                            style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 13, color: C.text, fontWeight: 600 }}>✏️ Edit</button>
                          <button onClick={() => handleDelete(ev)}
                            style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 13, color: '#ff6644', fontWeight: 600 }}>🗑️ Delete</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => handleFlag(ev)}
                      style={{ color: C.muted, fontSize: 14, padding: '0 4px', flexShrink: 0 }}>🚩</button>
                  )}
                </div>

                {/* By line */}
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>by @{host}</div>

                {/* Date + time */}
                {dateStr && (
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>
                    📅 {dateStr}{sltTime ? ` · ${sltTime} SLT` : ''}
                  </div>
                )}
                {localTimeStr && (
                  <div style={{ fontSize: 11, color: C.sky, marginBottom: 4 }}>🕐 {localTimeStr} your time</div>
                )}

                {ev.location_name && (
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>📍 {ev.location_name}</div>
                )}
                {ev.description && (
                  <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 12 }}>{ev.description}</div>
                )}
                {ev.slurl && (
                  <div style={{ fontSize: 11, color: C.sky, marginBottom: 12, fontWeight: 600 }}>🔗 {ev.slurl}</div>
                )}

                {/* Live-set controls. The performer who owns the gig sees Go Live
                    / End set; everyone else sees Listen while it's running. */}
                {ev.is_live_set && (() => {
                  const mine   = activePerformer && ev.performer_id === activePerformer.id;
                  const isLive = !!ev.live_session_id;
                  const busy   = goingLive === ev.id;
                  if (mine && !isLive) return (
                    <button onClick={() => handleGoLive(ev)} disabled={busy}
                      style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', marginBottom: 12,
                        background: busy ? C.border : `linear-gradient(135deg, #ff4466, ${C.peach})`,
                        color: busy ? C.muted : '#fff', fontWeight: 800, fontSize: 13, cursor: busy ? 'default' : 'pointer' }}>
                      {busy ? 'Starting…' : ev.last_ended_at ? '🔴 Go Live again' : '🔴 Go Live'}
                    </button>
                  );
                  if (mine && isLive) return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, padding: '8px 12px', background: C.card2, borderRadius: 10 }}>
                        <span style={{ fontSize: 15 }}>👂</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: C.sky }}>
                          {listeners[ev.live_session_id] ?? 0}
                        </span>
                        <span style={{ fontSize: 12, color: C.muted }}>
                          listening right now
                        </span>
                      </div>
                      <button onClick={() => handleEndSet(ev)} disabled={busy}
                      style={{ width: '100%', padding: '11px', borderRadius: 12, marginBottom: 12,
                        background: 'transparent', border: `1px solid #ff446666`,
                        color: '#ff6680', fontWeight: 800, fontSize: 13, cursor: busy ? 'default' : 'pointer' }}>
                      {busy ? 'Ending…' : '⏹ End set'}
                      </button>
                    </>
                  );
                  if (isLive) {
                    const playing = nowPlayingEventId === ev.id;
                    return (
                      <button onClick={() => playing ? onStopLive && onStopLive() : onPlayLive && onPlayLive(ev)}
                        style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', marginBottom: 12,
                          background: playing ? C.card2 : `linear-gradient(135deg,${C.sky},${C.peach})`,
                          color: playing ? C.sky : '#060d14', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                        {playing ? '⏸ Stop listening' : '🎧 Listen live'}
                      </button>
                    );
                  }
                  return null;
                })()}
                {/* Nobody RSVPs to their own event — the owner just sees the
                    counts below. */}
                {!isOwner && (
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
                )}
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
              <span className="sg" style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{editingEvent ? 'Edit event' : 'Create event'}</span>
              <button onClick={() => { setShowCreate(false); setEditingEvent(null); }} style={{ color: C.muted, fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '8px 12px', background: `${C.sky}11`, border: `1px solid ${C.sky}33`, borderRadius: 10, fontSize: 11, color: C.sky, lineHeight: 1.5 }}>
                ✅ Posting events is <strong>free</strong> for everyone.
              </div>

              {/* Event image */}
              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: .5 }}>EVENT IMAGE (optional)</label>
                {eventImageUrl ? (
                  <div style={{ position: 'relative', marginBottom: 4 }}>
                    <img src={eventImageUrl} alt="Event" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 12, display: 'block' }} />
                    <button onClick={() => { setEventImageUrl(''); setEventImageFile(null); }}
                      style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: '#000000aa', color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ) : (
                  <label style={{ display: 'block', cursor: 'pointer' }}>
                    <div style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: '20px', textAlign: 'center', background: C.card2 }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>{uploadingEventImage ? '⏳' : '🖼️'}</div>
                      <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{uploadingEventImage ? 'Uploading…' : 'Tap to add image'}</div>
                    </div>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      e.target.value = '';
                      setEventCropFile(file);
                    }} />
                  </label>
                )}
              </div>

              {/* Live set — performer identities only. The gig is posted AS the
                  performer and carries their stream. */}
              {activePerformer && (
                <div style={{ background: C.card2, border: `1px solid ${isLiveSet ? C.sky + '66' : C.border}`, borderRadius: 12, padding: '12px 14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={isLiveSet} onChange={e => setIsLiveSet(e.target.checked)}
                      style={{ width: 17, height: 17, accentColor: C.sky, cursor: 'pointer' }} />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>🔴 This is a live set</span>
                      <span style={{ display: 'block', fontSize: 11, color: C.muted, marginTop: 2 }}>
                        Posted as {activePerformer.brand_name}. You'll get a Go Live button on the event.
                      </span>
                    </span>
                  </label>
                  {isLiveSet && (
                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: .5 }}>STREAM URL *</label>
                      <input value={streamUrl} onChange={e => setStreamUrl(e.target.value)}
                        placeholder="http://your-stream-host:8000/live" className="inp" />
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 5, lineHeight: 1.5 }}>
                        Only shown to signed-in listeners while you're actually broadcasting.
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                  <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: .5 }}>DATE *</label>
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
                disabled={saving || !title.trim() || !date}
                style={{ width: '100%', background: saving || !title.trim() || !date ? C.border : `linear-gradient(135deg,${C.sky},${C.peach})`, color: saving || !title.trim() || !date ? C.muted : '#060d14', fontWeight: 900, fontSize: 14, padding: '13px', borderRadius: 14 }}>
                {saving ? '⏳ Saving…' : editingEvent ? 'Save changes →' : 'Create event →'}
              </button>
            </div>
          </div>
        </div>
      )}
      {eventCropFile && (
        <ImageCropModal
          file={eventCropFile}
          onCancel={() => setEventCropFile(null)}
          onCrop={(previewUrl, croppedFile) => {
            setEventCropFile(null);
            setEventImageUrl(previewUrl);
            setEventImageFile(croppedFile);
          }}
        />
      )}
    </div>
  );
}
