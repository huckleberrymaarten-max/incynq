import C from '../theme';

export default function Toggle({ on, onChange }) {
  return (
    <div onClick={onChange} style={{
      width: 44, height: 24, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
      background: on ? C.sky : C.border, transition: 'background .2s', position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: 3, left: on ? 22 : 3, width: 18, height: 18,
        borderRadius: '50%', background: on ? '#040f14' : C.muted,
        transition: 'left .2s, background .2s',
      }} />
    </div>
  );
}
