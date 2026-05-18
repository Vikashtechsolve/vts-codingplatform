import React, { createContext, useState, useContext, useEffect } from 'react';
import axiosInstance from '../utils/axios';
import { formatAuthRequestError } from '../utils/authErrors';
import { normalizeAuthUser, getUserVendorId } from '../utils/user';
import { setCachedBranding, clearBrandingCache } from '../utils/brandingCache';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // Restore user from localStorage immediately for instant UI
  const getStoredUser = () => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? normalizeAuthUser(JSON.parse(storedUser)) : null;
    } catch (error) {
      console.error('Error parsing stored user:', error);
      return null;
    }
  };

  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);
  const [, setToken] = useState(localStorage.getItem('token'));

  // Initialize: Restore user from localStorage and validate token
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = getStoredUser();

      if (storedToken && storedUser) {
        // Set user immediately from localStorage for instant UI
        setUser(normalizeAuthUser(storedUser));
        setToken(storedToken);
        
        // Then validate token with backend
        try {
          const response = await axiosInstance.get('/auth/me');
          const normalized = normalizeAuthUser(response.data);
          const vendorId = getUserVendorId(normalized) || response.data?.vendorId;
          if (vendorId) {
            normalized.vendorId = String(vendorId);
            if (normalized?.branding?.logo) {
              setCachedBranding(vendorId, normalized.branding);
            }
          }
          setUser(normalized);
          localStorage.setItem('user', JSON.stringify(normalized));
        } catch (error) {
          // Token is invalid, clear everything
          console.error('Token validation failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      }
      
      setLoading(false);
    };

    initializeAuth();
  }, []);

  // Cross-tab synchronization: Listen for storage changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'user') {
        const newToken = localStorage.getItem('token');
        const newUser = getStoredUser();
        
        if (newToken && newUser) {
          setToken(newToken);
          setUser(normalizeAuthUser(newUser));
        } else {
          setToken(null);
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axiosInstance.post('/auth/login', { email, password });
      const { token: newToken, user: userData } = response.data;
      
      const normalized = normalizeAuthUser(userData);
      const vendorId = getUserVendorId(normalized) || userData?.vendorId;
      if (vendorId) {
        normalized.vendorId = String(vendorId);
        if (normalized?.branding) {
          setCachedBranding(vendorId, normalized.branding);
        }
      }
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(normalized));
      setToken(newToken);
      setUser(normalized);
      window.dispatchEvent(new CustomEvent('platform:branding-changed'));

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: formatAuthRequestError(error, 'Login failed')
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axiosInstance.post('/auth/register', userData);
      const { token: newToken, user: userDataResponse } = response.data;
      
      const normalized = normalizeAuthUser(userDataResponse);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(normalized));
      setToken(newToken);
      setUser(normalized);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: formatAuthRequestError(error, 'Registration failed')
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    clearBrandingCache();
    setToken(null);
    setUser(null);
  };

  const updateUserBranding = (branding) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = normalizeAuthUser({ ...prev, branding });
      const vendorId = getUserVendorId(next);
      if (vendorId && branding?.logo) {
        setCachedBranding(vendorId, branding);
      }
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUserBranding,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

