import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  // Memoised: without this the context value is a fresh object on every toast
  // render, which changes the identity of `toast` for every consumer. Any
  // useCallback/useEffect that (correctly) lists `toast` as a dependency would
  // then re-run each time a toast appears — including data-loading effects.
  const value = useMemo(
    () => ({ success: (m) => push(m, 'success'), error: (m) => push(m, 'error') }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Above OrderPanel's details modal (z-[1000]) so a failed-order error
          is never visually trapped behind the overlay. */}
      <div className="fixed bottom-6 right-6 z-[1100] flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`text-sm px-4 py-3 shadow-lg border animate-[fadeIn_0.25s_ease] ${
              t.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-ink text-paper border-ink'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
