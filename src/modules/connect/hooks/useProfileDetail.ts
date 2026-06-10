import {useEffect, useState} from 'react';

import {connectionsService} from '../../connections/services/connections.service';
import {connectService} from '../services/connect.service';
import {ROLE_API_FRAGMENT} from '../types';
import type {ConnectionState, ConnectRoleKey, DirectoryUser} from '../types';

export type ProfileDetailState = {
  profile: Record<string, any>;
  isLoading: boolean;
  connState: ConnectionState;
  setConnState: (s: ConnectionState) => void;
  resolvedUuid: string;
};

export function useProfileDetail(
  token: string,
  role: ConnectRoleKey,
  user: DirectoryUser,
  currentUserId?: string,
): ProfileDetailState {
  const [profile, setProfile] = useState<Record<string, any>>(user.raw);
  const [isLoading, setIsLoading] = useState(true);
  const [connState, setConnState] = useState<ConnectionState>('none');
  const [resolvedUuid, setResolvedUuid] = useState(user.uuid);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      let uuid = user.uuid;
      try {
        const full = await connectService.getPublicProfile(token, role, user.profileUuid);
        if (cancelled) return;
        if (full && typeof full === 'object') {
          setProfile(prev => ({...prev, ...full}));
          const fromProfile =
            full?.user?.[0]?.uuid ||
            full?.user?.[0]?.userUUID ||
            full?.userUUID ||
            full?.userUuid;
          if (fromProfile) {
            uuid = fromProfile;
            setResolvedUuid(fromProfile);
          }
        }
      } catch {
        // non-fatal — screen still renders from search row data
      } finally {
        if (!cancelled) setIsLoading(false);
      }

      connectService.incrementViews(token, role, user.profileUuid);
      connectionsService.listActive(token, {page: 1, limit: 500}).catch(() => undefined);

      if (currentUserId) {
        connectService.incrementProfileViews(
          token,
          user.profileUuid,
          ROLE_API_FRAGMENT[role].singular,
          currentUserId,
        );
      }

      if (uuid) {
        connectService
          .checkConnectionState(token, uuid)
          .then(state => {
            if (!cancelled) setConnState(state);
          })
          .catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, role, user.profileUuid, user.uuid, currentUserId]);

  return {profile, isLoading, connState, setConnState, resolvedUuid};
}
