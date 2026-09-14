"use client";

import { sendGAEvent } from "@next/third-parties/google";

export function trackBoatEvent(name, params = {}) {
  if (typeof window === "undefined") return false;
  try {
    sendGAEvent("event", name, params);
    return true;
  } catch (error) {
    console.warn("GA4 event failed", name, error);
    return false;
  }
}

export function trackBoatEventOnce(storageKey, name, params = {}) {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(storageKey) === "1") return false;
    const sent = trackBoatEvent(name, params);
    if (sent) window.localStorage.setItem(storageKey, "1");
    return sent;
  } catch {
    return trackBoatEvent(name, params);
  }
}

export function markAnalyticsJourney(key, value = "1") {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {}
}

export function consumeAnalyticsJourney(key) {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(key);
    if (value !== null) window.sessionStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
}
