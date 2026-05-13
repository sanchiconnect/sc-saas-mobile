import React, {useState} from 'react';
import {StatusBar, StyleSheet, useColorScheme} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

import {FeedbackWidget} from './src/app/components/FeedbackWidget';
import {HomeScreen} from './src/app/HomeScreen';
import {AuthNavigator} from './src/auth/AuthNavigator';
import {
  AuthSession,
  LoginPayload,
  OtpRequestPayload,
  OtpRequestResult,
  SignupPayload,
} from './src/auth/models/auth.models';
import {authService} from './src/auth/services/auth.service';
import {AUTH_SCREENS, AuthScreen} from './src/auth/types';
import {TenantProvider} from './src/context/TenantProvider';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const shouldShowFeedback =
    session !== null ||
    (authScreen !== AUTH_SCREENS.LOGIN && authScreen !== AUTH_SCREENS.SIGNUP);

  const handleLogin = async (payload: LoginPayload) => {
    const nextSession = await authService.login(payload);
    setSession(nextSession);
    return nextSession;
  };

  const handleSignup = async (payload: SignupPayload) => {
    const nextSession = await authService.signup(payload);
    setSession(nextSession);
    setShowWelcomePopup(true);
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
  };

  return (
    <TenantProvider>
      <SafeAreaProvider>
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
              onCloseWelcomePopup={() => setShowWelcomePopup(false)}
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
