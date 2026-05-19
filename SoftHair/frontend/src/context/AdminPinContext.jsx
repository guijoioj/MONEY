import { createContext, useContext, useState, useCallback } from 'react';

const ADMIN_PIN = '190607';

const AdminPinContext = createContext(null);

export function AdminPinProvider({ children }) {
  const [pending, setPending] = useState(null); // { resolve }

  const verify = useCallback((pin) => pin === ADMIN_PIN, []);

  // Always opens the modal — no session caching
  const requestPin = useCallback(() => {
    return new Promise((resolve) => {
      setPending({ resolve });
    });
  }, []);

  const handleSubmit = useCallback((pin) => {
    if (verify(pin)) {
      if (pending) {
        pending.resolve(true);
        setPending(null);
      }
      return true;
    }
    return false;
  }, [verify, pending]);

  const handleCancel = useCallback(() => {
    if (pending) {
      pending.resolve(false);
      setPending(null);
    }
  }, [pending]);

  return (
    <AdminPinContext.Provider value={{ requestPin, handleSubmit, handleCancel, pending }}>
      {children}
    </AdminPinContext.Provider>
  );
}

export function useAdminPin() {
  const ctx = useContext(AdminPinContext);
  if (!ctx) throw new Error('useAdminPin must be used inside AdminPinProvider');
  return ctx;
}
