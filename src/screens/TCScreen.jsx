import { useEffect } from 'react';

export default function TCScreen({ onClose }) {
  useEffect(() => {
    window.open('https://incynq.net/terms.html', '_blank');
    onClose();
  }, []);
  return null;
}
