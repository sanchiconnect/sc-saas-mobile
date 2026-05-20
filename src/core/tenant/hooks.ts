import {useContext} from 'react';

import {TenantContext} from './TenantProvider';

export const useTenant = () => useContext(TenantContext);

/**
 * Returns whether a tenant feature flag is enabled.
 *
 * Mirrors the frontend's pattern of reading from the tenant's `features` object
 * (e.g. `features.chat`, `features.video_pitch_mandatory`). Use it to gate
 * menu items and entire screens at the component layer.
 *
 * Returns `false` while the tenant config is still loading or if the flag is
 * absent — i.e. "absence means off". Pass `defaultValue` to flip that default
 * for flags that should be on by default.
 */
export const useFeatureFlag = (
  name: string,
  defaultValue: boolean = false,
): boolean => {
  const {globalSetting} = useContext(TenantContext);
  const features = globalSetting?.features;
  if (!features) {
    return defaultValue;
  }
  const value = features[name];
  return typeof value === 'boolean' ? value : defaultValue;
};
