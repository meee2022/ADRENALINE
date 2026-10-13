/**
 * Apply an over-the-air update as soon as it is safe, instead of on the second launch.
 * expo-updates downloads in the background on load; once the bundle is ready we restart
 * right away if the app has only just opened, otherwise the next time it returns from the
 * background — never in the middle of a session where a subscriber may be picking meals.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

const FRESH_LAUNCH_MS = 10_000;

export function AutoUpdate() {
  const { isUpdatePending } = Updates.useUpdates();
  const openedAt = useRef(Date.now());
  useEffect(() => {
    if (!isUpdatePending) return;
    const reload = () => { void Updates.reloadAsync().catch(() => {}); };
    if (Date.now() - openedAt.current < FRESH_LAUNCH_MS) { reload(); return; }
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') reload(); });
    return () => sub.remove();
  }, [isUpdatePending]);
  return null;
}
