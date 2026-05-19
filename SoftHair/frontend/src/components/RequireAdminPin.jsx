import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminPin } from '../context/AdminPinContext';

/**
 * RequireAdminPin — bloqueia rota até user digitar PIN admin.
 *
 * Reseta `allowed` quando location.pathname muda → toda navegação pede PIN
 * de novo (fix do bug "PIN não pede ao re-entrar na mesma aba").
 */
export default function RequireAdminPin({ children }) {
  const { requestPin } = useAdminPin();
  const navigate = useNavigate();
  const location = useLocation();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAllowed(false); // reseta em toda mudança de rota
    requestPin().then((ok) => {
      if (cancelled) return;
      if (ok) setAllowed(true);
      else navigate(-1);
    });
    return () => { cancelled = true; };
  }, [location.pathname, requestPin, navigate]);

  if (!allowed) return null;
  return children;
}
