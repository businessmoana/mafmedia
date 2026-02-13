import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

function getTelegramInitData() {
  if (typeof window === 'undefined') return null;
  const tg = window.Telegram?.WebApp;
  return tg?.initData || null;
}

export function isTelegramWebApp() {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;
}

function isBrowserDev() {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [telegramAuthFailed, setTelegramAuthFailed] = useState(false);

  useEffect(() => {
    function tryTelegramAuth(initData) {
      setTelegramAuthFailed(false);
      api.auth.telegram(initData)
        .then(({ token, user: u }) => {
          localStorage.setItem('token', token);
          setUser(u);
        })
        .catch(() => {
          setUser(null);
          setTelegramAuthFailed(true);
        })
        .finally(() => setLoading(false));
    }

    const token = localStorage.getItem('token');
    if (token) {
      api.me()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('token');
          setUser(null);
        })
        .finally(() => setLoading(false));
      return;
    }

    if (isBrowserDev()) {
      api.auth.devAdmin()
        .then(({ token, user: u }) => {
          localStorage.setItem('token', token);
          setUser(u);
        })
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
      return;
    }

    // Telegram Mini App: initData can appear slightly after first paint (script load)
    let attempts = 0;
    const maxAttempts = 5;
    const delays = [0, 150, 400, 700, 1200];
    let timeoutId = null;

    function attemptTelegramAuth() {
      const initData = getTelegramInitData();
      if (initData) {
        tryTelegramAuth(initData);
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        const delay = delays[attempts] ?? 1200;
        timeoutId = setTimeout(attemptTelegramAuth, delay);
      } else {
        setUser(null);
        setLoading(false);
      }
    }

    attemptTelegramAuth();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, isTelegramApp: isTelegramWebApp(), telegramAuthFailed }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
