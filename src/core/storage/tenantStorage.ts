import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sc-saas-mobile.tenant.baseUrl';

// In-memory hot copy so we don't hit AsyncStorage on every API call.
let cachedBaseUrl: string | null = null;

export const saveBaseUrl = async (url: string): Promise<void> => {
  cachedBaseUrl = url;
  await AsyncStorage.setItem(KEY, url);
};

export const getBaseUrl = async (): Promise<string | null> => {
  if (cachedBaseUrl) {
    return cachedBaseUrl;
  }
  const stored = await AsyncStorage.getItem(KEY);
  if (stored) {
    cachedBaseUrl = stored;
  }
  return cachedBaseUrl;
};

export const clearBaseUrl = async (): Promise<void> => {
  cachedBaseUrl = null;
  await AsyncStorage.removeItem(KEY);
};
