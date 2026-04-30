import React from 'react';

import {AuthSession} from '../auth/models/auth.models';
import {HomeScreen} from './HomeScreen';

type DashboardScreenProps = {
  session: AuthSession;
  onLogout: () => void;
};

export function DashboardScreen({session, onLogout}: DashboardScreenProps) {
  return <HomeScreen session={session} onLogout={onLogout} />;
}
