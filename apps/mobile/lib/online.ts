import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

// A Simulator cannot be put offline from the host, so debug builds keep an
// override that wins over NetInfo (toggled from the profile screen).
let forcedOffline = false;

function publish(reachable: boolean): void {
  onlineManager.setOnline(forcedOffline ? false : reachable);
}

export function startNetworkWatcher(): () => void {
  NetInfo.fetch().then((state) => publish(state.isConnected !== false));
  return NetInfo.addEventListener((state) => {
    // `isInternetReachable` is null until the first probe resolves; only a
    // definite false counts as offline.
    publish(state.isConnected !== false && state.isInternetReachable !== false);
  });
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(() => onChange()),
    () => onlineManager.isOnline(),
  );
}

export function setForcedOffline(offline: boolean): void {
  forcedOffline = offline;
  onlineManager.setOnline(!offline);
}

export function isForcedOffline(): boolean {
  return forcedOffline;
}
