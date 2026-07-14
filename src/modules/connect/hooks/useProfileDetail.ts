import {useContext, useEffect, useState} from 'react';

import {TenantContext} from '../../../core/tenant/TenantProvider';
import {connectionsService} from '../../connections/services/connections.service';
import {connectService} from '../services/connect.service';
import {ROLE_API_FRAGMENT} from '../types';
import type {
  ConnectionStatusDetail,
  ConnectRoleKey,
  DirectoryUser,
} from '../types';

export type ProfileDetailState = {
  profile: Record<string, any>;
  isLoading: boolean;
  connDetail: ConnectionStatusDetail | null;
  setConnDetail: (d: ConnectionStatusDetail) => void;
  resolvedUuid: string;
};

export function useProfileDetail(
  token: string,
  role: ConnectRoleKey,
  user: DirectoryUser,
  currentUserNumericId?: string,
): ProfileDetailState {
  const {globalSetting} = useContext(TenantContext);
  const [profile, setProfile] = useState<Record<string, any>>(user.raw);
  const [isLoading, setIsLoading] = useState(true);
  const [connDetail, setConnDetail] = useState<ConnectionStatusDetail | null>(null);
  const [resolvedUuid, setResolvedUuid] = useState(user.uuid);

  // Explicit false only — tenants that haven't populated this flag yet keep
  // working exactly as before.
  const connectionsEnabled = globalSetting?.features?.connections !== false;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      let uuid = user.uuid;
      let reducedDtoConnectionStatus: string | undefined;
      try {
        const full = await connectService.getPublicProfile(token, role, user.profileUuid);
        if (cancelled) return;
        if (full && typeof full === 'object') {
          setProfile(prev => ({...prev, ...full}));
          // Try every known shape across all roles. Partners and service
          // providers may return `user` as a plain object (not an array),
          // or surface the UUID directly on the root response. otherUserUUID
          // is the reduced-DTO fallback (viewer hasn't got full access yet).
          const fromProfile =
            full?.user?.[0]?.uuid ||
            full?.user?.[0]?.userUUID ||
            full?.user?.uuid ||
            full?.user?.userUUID ||
            full?.users?.[0]?.uuid ||
            full?.userUUID ||
            full?.userUuid ||
            full?.otherUserUUID;
          if (fromProfile) {
            uuid = fromProfile;
            setResolvedUuid(fromProfile);
          } else {
            reducedDtoConnectionStatus = full?.connectionStatus;
          }
        }
      } catch {
        // non-fatal — screen still renders from search row data
      } finally {
        if (!cancelled) setIsLoading(false);
      }

      if (role !== 'program-office-team') {
        connectService.incrementViews(token, role, user.profileUuid);
      }
      connectionsService.listActive(token, {page: 1, limit: 500}).catch(() => undefined);

      if (currentUserNumericId) {
        connectService.incrementProfileViews(
          token,
          user.profileUuid,
          ROLE_API_FRAGMENT[role].singular,
          currentUserNumericId,
        );
      }

      if (!connectionsEnabled) {
        return;
      }

      if (uuid) {
        connectService
          .checkConnectionState(token, uuid)
          .then(detail => {
            if (!cancelled) setConnDetail(detail);
          })
          .catch(() => {});
      } else if (reducedDtoConnectionStatus === 'pending') {
        // Reduced DTO with no resolvable uuid at all — mirror the web's
        // fallback so a pending request still shows instead of reverting to
        // "Connect".
        setConnDetail({state: 'pending'});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, role, user.profileUuid, user.uuid, currentUserNumericId, connectionsEnabled]);

  return {profile, isLoading, connDetail, setConnDetail, resolvedUuid};
}
