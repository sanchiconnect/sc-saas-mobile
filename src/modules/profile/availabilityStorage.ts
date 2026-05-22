import AsyncStorage from '@react-native-async-storage/async-storage';

// Persists Account Settings → Availability Hours locally while the backend
// contract isn't finalized. Scoped per user id so a tenant with multiple
// signed-in accounts doesn't see another user's staged data.

export type StoredAvailability = {
  mode: 'anytime' | 'temporary-unavailable' | 'specific-days';
  weekly: Array<{
    dayKey: string;
    label: string;
    fromTime: string;
    toTime: string;
    unavailable: boolean;
  }>;
  specificDates: Array<{
    id: string;
    dateLabel: string;
    fromTime: string;
    toTime: string;
    unavailable: boolean;
  }>;
};

const keyFor = (userId: string) =>
  `sc-saas-mobile.availability.${userId}`;

export const loadAvailability = async (
  userId: string,
): Promise<StoredAvailability | null> => {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as StoredAvailability;
  } catch {
    return null;
  }
};

export const saveAvailability = async (
  userId: string,
  data: StoredAvailability,
): Promise<void> => {
  if (!userId) return;
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(data));
};
