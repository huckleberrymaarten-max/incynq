import { useEffect } from 'react';

export default function HelpScreen({ onClose }) {
  useEffect(() => {
    window.open('https://incynq.net/faq.html', '_blank');
    onClose();
  }, []);
  return null;
}
