"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_SETUP_PREFERENCES, parseSetupPreferences, setupPreferencesKey, type SetupPreferences } from "./setup-preferences";

const initialSnapshot = JSON.stringify(DEFAULT_SETUP_PREFERENCES);
const sessionPreferences = new Map<string, string>();
const changeEvent = "study-planner:guided-setup-change";

function readSnapshot(key: string): string {
  const sessionValue = sessionPreferences.get(key);
  if (sessionValue !== undefined) return sessionValue;
  try { return window.localStorage.getItem(key) ?? sessionPreferences.get(key) ?? initialSnapshot; }
  catch { return sessionPreferences.get(key) ?? initialSnapshot; }
}

export function useSetupPreferences(userId: string) {
  const key = setupPreferencesKey(userId);
  const subscribe = useCallback((listener: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) {
        if (event.key === null) sessionPreferences.clear(); else sessionPreferences.delete(key);
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(changeEvent, listener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(changeEvent, listener);
    };
  }, [key]);
  const snapshot = useSyncExternalStore(subscribe, useCallback(() => readSnapshot(key), [key]), () => initialSnapshot);
  const preferences = useMemo(() => parseSetupPreferences(snapshot), [snapshot]);
  const updatePreferences = useCallback((patch: Partial<SetupPreferences>) => {
    const value = JSON.stringify({ ...parseSetupPreferences(readSnapshot(key)), ...patch });
    sessionPreferences.set(key, value);
    try { window.localStorage.setItem(key, value); } catch { /* Le parcours reste utilisable pour cette session. */ }
    window.dispatchEvent(new Event(changeEvent));
  }, [key]);
  return { preferences, updatePreferences };
}
