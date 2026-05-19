import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminPin } from '../context/AdminPinContext';

export default function RequireAdminPin({ children }) {
  const { requestPin } = useAdminPin();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Sempre pede PIN — sem cache de sessão
    requestPin().then((ok) => {
      if (cancelled) return;
      if (ok) {
        setAllowed(true);
      } else {
        navigate(-1);
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!allowed) return null;
  return children;
}
