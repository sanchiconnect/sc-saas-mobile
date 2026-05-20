import React, {useEffect, useState} from 'react';
import {StatusBar, StyleSheet, useColorScheme} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

import {FeedbackWidget} from './src/modules/feedback/FeedbackWidget';
import {HomeScreen} from './src/modules/home/HomeScreen';
import {AuthNavigator} from './src/modules/auth/AuthNavigator';
import {
  AuthSession,
  LoginPayload,
  OtpRequestPayload,
  OtpRequestResult,
  SignupPayload,
} from './src/modules/auth/models/auth.models';
import {authService} from './src/modules/auth/services/auth.service';
import {AUTH_SCREENS, AuthScreen} from './src/modules/auth/types';
import {setSessionInvalidHandler} from './src/core/api/apiClient';
import {TenantProvider} from './src/core/tenant/TenantProvider';
import {ToastProvider} from './src/core/toast/ToastProvider';
import {
  clearSession,
  loadSession,
  saveSession,
} from './src/core/storage/sessionStorage';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  // Set to true immediately after signup so HomeScreen mounts straight into
  // Edit Profile. Mirrors the frontend's role-specific redirect to edit/<role>
  // after register. Cleared once the user navigates away.
  const [justSignedUp, setJustSignedUp] = useState(false);
  const shouldShowFeedback =
    session !== null ||
    (authScreen !== AUTH_SCREENS.LOGIN && authScreen !== AUTH_SCREENS.SIGNUP);

  useEffect(() => {
    loadSession()
      .then(restored => {
        if (restored) {
          setSession(restored);
        }
      })
      .catch(() => {
        // Restoring is best-effort; failure just means user re-logs in.
      });
  }, []);

  // Mirrors the frontend's "Session expired" handler in ProfileService: any
  // authenticated 401 from the backend tears down the session and routes back
  // to login. apiClient.requestJson invokes the handler.
  useEffect(() => {
    setSessionInvalidHandler(() => {
      setSession(null);
      setAuthScreen(AUTH_SCREENS.LOGIN);
      clearSession().catch(() => {});
    });
    return () => setSessionInvalidHandler(null);
  }, []);

  const handleLogin = async (payload: LoginPayload) => {
    const nextSession = await authService.login(payload);
    // Persist before flipping in-memory state so a crash between the two
    // doesn't leave Keychain empty while the UI thinks the user is logged in.
    await saveSession(nextSession);
    setSession(nextSession);
    return nextSession;
  };

  const handleSignup = async (payload: SignupPayload) => {
    const nextSession = await authService.signup(payload);
    await saveSession(nextSession);
    setSession(nextSession);
    setShowWelcomePopup(true);
    setJustSignedUp(true);
    return nextSession;
  };

  const handleSendOtp = async (
    payload: OtpRequestPayload,
  ): Promise<OtpRequestResult> => {
    return authService.sendOtp(payload);
  };

  const handleLogout = () => {
    setSession(null);
    setAuthScreen(AUTH_SCREENS.LOGIN);
    setJustSignedUp(false);
    clearSession().catch(() => {
      // Keychain reset failure is non-blocking — in-memory state is already cleared.
    });
  };

  return (
    <TenantProvider>
      <SafeAreaProvider>
        <ToastProvider>
        <SafeAreaView
          style={[
            styles.appShell,
            isDarkMode ? styles.appShellDark : styles.appShellLight,
          ]}>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          {session ? (
            <HomeScreen
              session={session}
              onLogout={handleLogout}
              showWelcomePopup={showWelcomePopup}
              onCloseWelcomePopup={() => {
                setShowWelcomePopup(false);
                setJustSignedUp(false);
              }}
              initialSection={justSignedUp ? 'edit-profile' : undefined}
            />
          ) : (
            <AuthNavigator
              currentScreen={authScreen}
              onLogin={handleLogin}
              onNavigate={setAuthScreen}
              onSendOtp={handleSendOtp}
              onSignup={handleSignup}
            />
          )}
          {shouldShowFeedback ? <FeedbackWidget /> : null}
        </SafeAreaView>
        </ToastProvider>
      </SafeAreaProvider>
    </TenantProvider>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
  },
  appShellDark: {
    backgroundColor: '#0f172a',
  },
  appShellLight: {
    backgroundColor: '#e2e8f0',
  },
});

export default App;
