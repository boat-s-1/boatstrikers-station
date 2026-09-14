"use client";

export function trackBoatEvent(name, params = {}) {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params);
    }
  } catch (error) {
    console.warn("GA4 event failed", name, error);
  }
}

export function trackBoatEventOnce(storageKey, name, params = {}) {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(storageKey) === "1") return;
    trackBoatEvent(name, params);
    window.localStorage.setItem(storageKey, "1");
  } catch {
    trackBoatEvent(name, params);
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
