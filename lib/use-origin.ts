"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => window.location.origin;
const getServerSnapshot = () => "";

/**
 * The current page origin, or "" during SSR and the first client render.
 * Keeps server and client markup identical so URLs don't trip hydration.
 */
export function useOrigin() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
