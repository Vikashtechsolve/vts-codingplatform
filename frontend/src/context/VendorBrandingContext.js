import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import axiosInstance from '../utils/axios';
import { applyBrandingToDocument, clearBrandingFromDocument } from '../utils/applyBranding';
import { getUserVendorId, getBrandingFromUser, isVendorScopedUser } from '../utils/user';
import { getCachedBranding, setCachedBranding } from '../utils/brandingCache';
import {
  normalizeBrandingPayload,
  mergeBranding,
  hasVisibleBranding,
} from '../utils/brandingMerge';

const VendorBrandingContext = createContext(null);

export const useVendorBranding = () => {
  const ctx = useContext(VendorBrandingContext);
  if (!ctx) {
    throw new Error('useVendorBranding must be used within VendorBrandingProvider');
  }
  return ctx;
};

const applyBrandingState = (branding) => {
  if (branding?.settings) {
    applyBrandingToDocument(branding.settings);
  }
};

export const VendorBrandingProvider = ({ children }) => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(false);
  const brandingRef = useRef(null);
  const publicVendorIdRef = useRef(null);

  useEffect(() => {
    brandingRef.current = branding;
  }, [branding]);

  const commitBranding = useCallback((incoming, vendorIdOverride) => {
    const normalized = normalizeBrandingPayload(incoming);
    if (!normalized) return;
    setBranding((prev) => {
      const merged = mergeBranding(prev, normalized);
      if (!merged) return prev;
      applyBrandingState(merged);
      const vendorId = vendorIdOverride || getUserVendorId(user);
      if (vendorId && merged.logo) {
        setCachedBranding(vendorId, merged);
      }
      return merged;
    });
  }, [user]);

  const applyPublicBranding = useCallback((incoming, vendorId) => {
    if (!vendorId || !incoming) return;
    publicVendorIdRef.current = String(vendorId);
    commitBranding(incoming, vendorId);
  }, [commitBranding]);

  const clearPublicBranding = useCallback(() => {
    publicVendorIdRef.current = null;
    if (!isAuthenticated) {
      setBranding(null);
      clearBrandingFromDocument();
    }
  }, [isAuthenticated]);

  const fetchStudentBranding = useCallback(async () => {
    const { data } = await axiosInstance.get('/students/branding');
    const payload = {
      logo: data.logo,
      companyName: data.companyName,
      settings: data.settings,
    };
    const vendorId = data.vendorId || getUserVendorId(user);
    if (payload.logo || payload.companyName) {
      commitBranding(payload, vendorId);
    }
    return payload.logo || null;
  }, [user, commitBranding]);

  const fetchVendorAdminBranding = useCallback(async () => {
    const { data } = await axiosInstance.get('/vendor-admin/vendor');
    if (data?.logo) {
      commitBranding({
        logo: data.logo,
        companyName: data.companyName,
        settings: data.settings,
      });
      return data.logo;
    }
    return null;
  }, [commitBranding]);

  const loadAllSources = useCallback(async () => {
    if (!isAuthenticated || !isVendorScopedUser(user)) {
      if (!isAuthenticated) {
        if (publicVendorIdRef.current) {
          const cached = getCachedBranding(publicVendorIdRef.current);
          if (cached?.logo) {
            commitBranding(cached, publicVendorIdRef.current);
          } else if (brandingRef.current?.logo) {
            applyBrandingState(brandingRef.current);
          }
          return;
        }
        setBranding(null);
        clearBrandingFromDocument();
      }
      return;
    }

    let vendorId = getUserVendorId(user);

    const cached = vendorId ? getCachedBranding(vendorId) : null;
    if (cached?.logo) {
      commitBranding(cached, vendorId);
    }

    const embedded = getBrandingFromUser(user);
    if (embedded?.logo) {
      commitBranding(embedded, vendorId);
    }

    let resolvedLogo = cached?.logo || embedded?.logo || null;

    setLoading(true);
    try {
      const { data } = await axiosInstance.get('/auth/branding');
      if (data?.vendorId) {
        vendorId = String(data.vendorId);
      }
      if (data?.logo) {
        commitBranding(data, vendorId);
        resolvedLogo = data.logo;
      } else if (data?.companyName) {
        commitBranding(data, vendorId);
      }

      // Role-specific endpoints (same data as Settings for vendor; fixes students)
      if (!resolvedLogo && user.role === 'student') {
        try {
          resolvedLogo = await fetchStudentBranding();
        } catch (err) {
          console.error('[branding] student branding failed:', err?.message || err);
        }
      }

      if (!resolvedLogo && user.role === 'vendor_admin') {
        try {
          resolvedLogo = await fetchVendorAdminBranding();
        } catch (err) {
          console.error('[branding] vendor-admin branding failed:', err?.message || err);
        }
      }
    } catch (err) {
      console.error('[branding] auth/branding failed:', err?.message || err);

      if (user.role === 'student') {
        try {
          await fetchStudentBranding();
        } catch (studentErr) {
          console.error('[branding] student fallback failed:', studentErr?.message || studentErr);
        }
      } else if (user.role === 'vendor_admin') {
        try {
          await fetchVendorAdminBranding();
        } catch (vendorErr) {
          console.error('[branding] vendor fallback failed:', vendorErr?.message || vendorErr);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [
    isAuthenticated,
    user,
    commitBranding,
    fetchStudentBranding,
    fetchVendorAdminBranding,
  ]);

  useEffect(() => {
    if (authLoading) return;
    loadAllSources();
  }, [authLoading, loadAllSources]);

  useEffect(() => {
    const onBrandingChanged = () => {
      if (isAuthenticated && isVendorScopedUser(user)) {
        loadAllSources();
      }
    };
    window.addEventListener('platform:branding-changed', onBrandingChanged);
    return () => window.removeEventListener('platform:branding-changed', onBrandingChanged);
  }, [isAuthenticated, user, loadAllSources]);

  // Re-hydrate when user object updates (login, /auth/me)
  useEffect(() => {
    if (!isAuthenticated || !isVendorScopedUser(user)) return;
    const fromUser = getBrandingFromUser(user);
    if (fromUser?.logo) {
      commitBranding(fromUser, getUserVendorId(user));
    }
  }, [user?.id, user?.branding?.logo, user?.vendorId, isAuthenticated, commitBranding, user]);

  const updateBranding = useCallback((partial) => {
    setBranding((prev) => {
      const merged = mergeBranding(prev, normalizeBrandingPayload(partial));
      applyBrandingState(merged);
      const vendorId = getUserVendorId(user);
      if (vendorId && merged?.logo) {
        setCachedBranding(vendorId, merged);
      }
      return merged;
    });
  }, [user]);

  const value = {
    branding,
    loading,
    refreshBranding: loadAllSources,
    updateBranding,
    applyPublicBranding,
    clearPublicBranding,
    hasLogo: hasVisibleBranding(branding) && Boolean(branding?.logo),
  };

  return (
    <VendorBrandingContext.Provider value={value}>
      {children}
    </VendorBrandingContext.Provider>
  );
};
