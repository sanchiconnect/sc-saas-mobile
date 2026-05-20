import * as Keychain from 'react-native-keychain';

import type {AuthSession} from '../../modules/auth/models/auth.models';

const SESSION_SERVICE = 'sc-saas-mobile.session';

export const saveSession = async (session: AuthSession): Promise<void> => {
  await Keychain.setGenericPassword('session', JSON.stringify(session), {
    service: SESSION_SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
  });
};

export const loadSession = async (): Promise<AuthSession | null> => {
  const credentials = await Keychain.getGenericPassword({
    service: SESSION_SERVICE,
  });
  if (!credentials) {
    return null;
  }
  try {
    return JSON.parse(credentials.password) as AuthSession;
  } catch {
    // Stored payload is corrupted; treat as no session and clear it.
    await clearSession();
    return null;
  }
};

export const clearSession = async (): Promise<void> => {
  await Keychain.resetGenericPassword({service: SESSION_SERVICE});
};
