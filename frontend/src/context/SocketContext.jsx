import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.close();
        setSocket(null);
      }
      return;
    }

    const url = import.meta.env.DEV ? '' : window.location.origin;
    const token = localStorage.getItem('token');
    const s = io(url, {
      path: '/socket.io',
      autoConnect: true,
      auth: token ? { token } : undefined,
    });

    s.on('connect', () => {
      console.debug('[socket] connected');
    });
    s.on('disconnect', (reason) => {
      console.debug('[socket] disconnected', reason);
    });

    setSocket(s);
    return () => {
      s.close();
      setSocket(null);
    };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
