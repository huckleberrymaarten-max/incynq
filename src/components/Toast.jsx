import C from '../theme';

export default function Toast({ msg, type = 'ok' }) {
  const bg = type === 'gold' ? C.gold : type === 'error' ? '#ff4444' : C.green;
  return (
    <div style={{
      position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)',
      background: bg, color: '#040f14', padding: '9px 18px', borderRadius: 20,
      fontWeight: 700, fontSize: 13, zIndex: 9999, whiteSpace: 'nowrap',
      boxShadow: `0 4px 20px ${bg}66`, animation: 'fadeUp .2s ease',
    }}>
      {msg}
    </div>
  );
}
