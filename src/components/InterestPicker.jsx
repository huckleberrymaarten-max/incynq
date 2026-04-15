import C from '../theme';
import { INTEREST_GROUPS } from '../data';

export default function InterestPicker({ selectedGroups, selectedSubs, onGroupToggle, onSubToggle }) {
  return (
    <div>
      {/* Groups */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
        {INTEREST_GROUPS.map(g => (
          <button key={g.id} onClick={() => onGroupToggle(g.id)}
            style={{ fontSize: 11, padding: '6px 13px', borderRadius: 20, fontWeight: 700,
              border: `1.5px solid ${selectedGroups.includes(g.id) ? g.color : C.border}`,
              background: selectedGroups.includes(g.id) ? `${g.color}22` : 'transparent',
              color: selectedGroups.includes(g.id) ? g.color : C.sub, transition: 'all .15s' }}>
            {g.icon ? `${g.icon} ${g.label}` : g.label}
          </button>
        ))}
      </div>

      {/* Subcategories — shown for selected groups */}
      {INTEREST_GROUPS.filter(g => selectedGroups.includes(g.id)).map(g => (
        <div key={g.id} style={{ marginBottom: 10, padding: 11, background: C.card2, borderRadius: 12, border: `1px solid ${g.color}33` }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: g.color, marginBottom: 7 }}>{g.icon} {g.label} subgroups</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {(g.subs || []).map(s => (
              <button key={s} onClick={() => onSubToggle(s)}
                style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, fontWeight: 700,
                  border: `1px solid ${selectedSubs.includes(s) ? g.color : C.border}`,
                  background: selectedSubs.includes(s) ? `${g.color}22` : 'transparent',
                  color: selectedSubs.includes(s) ? g.color : C.muted, transition: 'all .15s' }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
