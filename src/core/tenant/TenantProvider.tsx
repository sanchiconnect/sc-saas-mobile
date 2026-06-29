import React, {createContext, ReactNode, useEffect, useState} from 'react';

import {fetchSettingStyle, fetchTenantsSetting} from './tenant.service';
import {saveBaseUrl} from '../storage/tenantStorage';
import type {IGlobalSetting} from './tenantTypes';

type ThemeType = {
  primary: string;
  secondary: string;
  danger: string;
  success: string;
};

type TenantContextType = {
  baseUrl: string | null;
  loading: boolean;
  tenantError: boolean;
  theme: ThemeType | null;
  // Tenant web domain (customDomain preferred, else the default domain) from
  // /verify_tenant. Used to build shareable web links to in-app content.
  domain: string | null;
  globalSetting?: IGlobalSetting | null;
};

type Props = {
  children: ReactNode;
};

export const TenantContext = createContext<TenantContextType>({
  baseUrl: null,
  loading: true,
  tenantError: false,
  theme: null,
  domain: null,
  globalSetting: null,
});

export const TenantProvider = ({children}: Props) => {
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeType | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [globalSetting, setGlobalSetting] =
    useState<TenantContextType['globalSetting']>(null);
  const [tenantError, setTenantError] = useState(false);

  const settingInit = async (
    url: string,
    verifyData?: {
      active?: boolean;
      subscription_active?: boolean;
      customDomain?: string | null;
    },
  ) => {
    try {
      const res = await fetchSettingStyle(url);
      // Settings API returns a flat object (no `data` wrapper).
      // Fall back to `res` itself so all keys resolve correctly.
      const settingsData = res?.data ?? res ?? {};
      const branding = settingsData?.branding;
      console.log('settingsData', settingsData?.WhyDoYouWantToConnectWithStartupsOptions);
      setGlobalSetting({
        // Branding
        brandName: settingsData?.branding?.brandName,
        logo: settingsData?.branding?.logo,
        startupOnboardingModal: settingsData?.startupOnboardingModal ?? undefined,

        // CDN / storage
        assetsImgKitUrl: settingsData?.assetsImgKitUrl,
        s3Bucket: settingsData?.s3Bucket,
        imgKitUrl: settingsData?.imgKitUrl,
        s3Url: settingsData?.s3Url,

        // Feature flags (fully typed, cast from raw API object)
        users: settingsData?.users ?? undefined,
        features: settingsData?.features ?? undefined,

        // Maintenance window
        maintenance_mode: settingsData?.maintenance_mode ?? null,

        // Tenant status — from verify_tenant, passed in as verifyData
        active: verifyData?.active,
        subscription_active:
          verifyData?.subscription_active ??
          settingsData?.subscription_active,
        subscription_active_message:
          settingsData?.subscription_active_message,
        customDomain: verifyData?.customDomain,

        // Config limits
        startupMaxIndustries: settingsData?.startupMaxIndustries,
        startupMaxTechnologies: settingsData?.startupMaxTechnologies,
        investorMaxIndustries: settingsData?.investorMaxIndustries,
        investorMaxInvestabilityMetrics:
          settingsData?.investorMaxInvestabilityMetrics,
        mentorMaxDomainAreas: settingsData?.mentorMaxDomainAreas,
        mentorMaxIndustries: settingsData?.mentorMaxIndustries,
        mentorMaxTechnologies: settingsData?.mentorMaxTechnologies,
        // Tenant-configurable enums
        CorporateSizes: Array.isArray(settingsData?.CorporateSizes)
          ? settingsData.CorporateSizes
          : [],
        memberRoles: Array.isArray(settingsData?.memberRoles)
          ? settingsData.memberRoles
          : [],
        WhyDoYouWantToConnectWithStartupsOptions: Array.isArray(settingsData?.WhyDoYouWantToConnectWithStartupsOptions)
          ? settingsData.WhyDoYouWantToConnectWithStartupsOptions: [],
      });
      setTheme({
        primary: branding?.colors?.primary,
        secondary: branding?.colors?.secondary,
        danger: branding?.colors?.danger,
        success: branding?.colors?.success,
      });
    } catch (error) {
      console.log('Tenant error', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetchTenantsSetting();
        const url = res?.data?.apiUrl;
        // Prefer a tenant's custom domain over the default for share links.
        const tenantDomain = res?.data?.customDomain || res?.data?.domain;
        if (tenantDomain) setDomain(tenantDomain);

        if (url) {
          setBaseUrl(url);
          await saveBaseUrl(url);
          // Pass verify_tenant fields through to settingInit so they are
          // merged into globalSetting alongside the /settings response.
          await settingInit(url, {
            active: res?.data?.active,
            subscription_active: res?.data?.subscription_active,
            customDomain: res?.data?.customDomain,
          });
        } else {
          setTenantError(true);
        }
      } catch (error) {
        console.log('Tenant error', error);
        setTenantError(true);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  return (
    <TenantContext.Provider
      value={{baseUrl, loading, tenantError, theme, domain, globalSetting}}>
      {children}
    </TenantContext.Provider>
  );
};
