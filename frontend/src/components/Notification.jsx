import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export default function Notification() {
  const { notification } = useApp();
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    if (notification) {
      setCurrent(notification);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [notification]);

  if (!current) return null;

  const icons = {
    success: <CheckCircle size={18} />,
    error: <AlertCircle size={18} />,
    info: <Info size={18} />,
  };

  return (
    <div className={`notification notification-${current.type} ${visible ? 'notification-enter' : 'notification-exit'}`}>
      {icons[current.type] || icons.info}
      <span>{current.message}</span>
      <button className="notif-close" onClick={() => setVisible(false)} title="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}
