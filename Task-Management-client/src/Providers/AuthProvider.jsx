import { onAuthStateChanged } from 'firebase/auth';
import { createContext, useEffect, useState } from 'react';
import { auth } from '../firebase/firebase.config';
import { io } from 'socket.io-client';

export const AuthContext = createContext();
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  let themeLocalStorage = localStorage.getItem('theme');
  let myTheme = themeLocalStorage ? themeLocalStorage : 'light';
  const [theme, setTheme] = useState(myTheme);
  const [socket, setSocket] = useState(null);

  // theme controller
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  useEffect(() => {
    const newSocket = io('https://taskflow-server-f50d.onrender.com');
    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, []);

  const authInfo = {
    user,
    setUser,
    loading,
    toggleTheme,
    theme,
    socket,
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={authInfo}>{children}</AuthContext.Provider>
  );
};

export default AuthProvider;
