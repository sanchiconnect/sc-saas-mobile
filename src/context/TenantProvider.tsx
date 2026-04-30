import React, {createContext, ReactNode, useEffect, useState} from 'react';

import {fetchSettingStyle, fetchTenantsSetting} from '../api/fetchSetting';
import {saveBaseUrl} from '../storage/tenantStorage';

type ThemeType = {
  primary: string;
  secondary: string;
  danger: string;
  success: string;
};

type TenantContextType = {
  baseUrl: string | null;
  loading: boolean;
  theme: ThemeType | null;
  globalSetting?: {
    brandName?: string;
    logo?: string;
    assetsImgKitUrl?: string;
    s3Bucket?: string;
    imgKitUrl?: string;
    s3Url?: string;
  } | null;
};

type Props = {
  children: ReactNode;
};

export const TenantContext = createContext<TenantContextType>({
  baseUrl: null,
  loading: true,
  theme: null,
  globalSetting: null,
});

export const TenantProvider = ({children}: Props) => {
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeType | null>(null);
  const [globalSetting, setGlobalSetting] =
    useState<TenantContextType['globalSetting']>(null);

  const settingInit = async (url: string) => {
    try {
      const res = await fetchSettingStyle(url);
      const branding = res?.data?.branding;
      const settingsData = res?.data || {};
      setGlobalSetting({
        brandName: settingsData?.branding?.brandName,
        assetsImgKitUrl: settingsData?.assetsImgKitUrl,
        logo: settingsData?.branding?.logo,
        s3Bucket: settingsData?.s3Bucket,
        imgKitUrl: settingsData?.imgKitUrl,
        s3Url: settingsData?.s3Url,
        
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

        if (url) {
          setBaseUrl(url);
          await saveBaseUrl(url);
          await settingInit(url);
        }
      } catch (error) {
        console.log('Tenant error', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  return (
    <TenantContext.Provider value={{baseUrl, loading, theme, globalSetting}}>
      {children}
    </TenantContext.Provider>
  );
};
