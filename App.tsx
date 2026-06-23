import React, {useContext, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
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
import {TenantContext, TenantProvider} from './src/core/tenant/TenantProvider';
import {ToastProvider} from './src/core/toast/ToastProvider';
import {
  clearSession,
  loadSession,
  saveSession,
} from './src/core/storage/sessionStorage';

// Reads TenantContext so it can gate on `loading` (TenantProvider must be
// an ancestor, which is why this lives in a separate component from App).
function AppContent() {
  const isDarkMode = useColorScheme() === 'dark';
  const {loading, theme} = useContext(TenantContext);

  const [session, setSession] = useState<AuthSession | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [justSignedUp, setJustSignedUp] = useState(false);
  const [feedbackFabSuppressed, setFeedbackFabSuppressed] = useState(false);
  const shouldShowFeedback = session !== null && !feedbackFabSuppressed;

  useEffect(() => {
    if (session !== null) return;
    const onBackPress = () => {
      if (authScreen === AUTH_SCREENS.OTP) {
        setAuthScreen(AUTH_SCREENS.LOGIN);
        return true;
      }
      if (authScreen === AUTH_SCREENS.SIGNUP) {
        setAuthScreen(AUTH_SCREENS.ROLE);
        return true;
      }
      if (authScreen === AUTH_SCREENS.ROLE) {
        setAuthScreen(AUTH_SCREENS.LOGIN);
        return true;
      }
      return true;
    };
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    );
    return () => subscription.remove();
  }, [session, authScreen]);

  useEffect(() => {
    loadSession()
      .then(restored => {
        if (restored) setSession(restored);
      })
      .catch(() => {});
  }, []);

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
    clearSession().catch(() => {});
  };

  // Show centered spinner while verify_tenant + global/settings APIs resolve.
  if (loading) {
    const spinnerColor = theme?.primary || '#6366f1';
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={spinnerColor} />
      </View>
    );
  }

  return (
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
          initialSection={undefined}
          onSuppressFeedbackFab={setFeedbackFabSuppressed}
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
  );
}

function App() {
  return (
    <TenantProvider>
      <SafeAreaProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </SafeAreaProvider>
    </TenantProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
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
