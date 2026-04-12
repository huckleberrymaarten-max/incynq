import C from '../theme';
import { gridStatusColor } from '../data';

export default function Av({ src, size = 36, ring = C.sky, online, status, onClick }) {
  const statusColor = status ? gridStatusColor(status) : online ? C.green : C.muted;
  return (
    <div onClick={onClick} style={{
      position: 'relative', flexShrink: 0,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{
        width: size, height: size, borderRadius: '18%',
        border: `2px solid ${ring}`, boxShadow: `0 0 10px ${ring}44`, overflow: 'hidden',
      }}>
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      {(online !== undefined || status) && (
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 11, height: 11, borderRadius: '50%',
          background: statusColor, border: `2px solid ${C.bg}`,
        }} />
      )}
    </div>
  );
}
