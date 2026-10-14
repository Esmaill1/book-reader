'use client';

const STORAGE_KEY = 'bookera_auth_code';
const EVENT_NAME = 'bookera_auth_code_changed';

/**
 * Generates an 8-character memorable, distinct library code: ERA-XXXX-XXXX
 * Uses unambiguous characters (no 0/O, 1/I/L).
 */
export function generateLibraryCode(): string {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 4; i++) {
    p1 += chars.charAt(Math.floor(Math.random() * chars.length));
    p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ERA-${p1}-${p2}`;
}

/**
 * Returns the currently active library code.
 * If URL has ?code= or ?auth=, it takes priority and saves to localStorage.
 * If none exists in localStorage, creates a new default code.
 */
export function getLibraryCode(): string {
  if (typeof window === 'undefined') return 'ERA-DEFAULT';

  // Check URL query parameters first (e.g., ?code=ERA-9X2M-4K7L)
  try {
    const params = new URLSearchParams(window.location.search);
    const queryCode = params.get('code') || params.get('auth');
    if (queryCode && queryCode.trim().length >= 3) {
      const normalized = queryCode.trim().toUpperCase();
      localStorage.setItem(STORAGE_KEY, normalized);
      // Clean query parameter from URL without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('auth');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      return normalized;
    }
  } catch {
    // Ignore URL parse errors
  }

  // Check localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored.trim().length >= 3) {
    return stored.trim().toUpperCase();
  }

  // Generate and store initial code
  const fresh = generateLibraryCode();
  localStorage.setItem(STORAGE_KEY, fresh);
  return fresh;
}

/**
 * Sets and switches to a new library code.
 * Dispatches an event so all components react immediately.
 */
export function setLibraryCode(newCode: string): string {
  if (typeof window === 'undefined') return newCode;
  const normalized = newCode.trim().toUpperCase();
  if (!normalized || normalized.length < 3) {
    throw new Error('Library code must be at least 3 characters.');
  }

  localStorage.setItem(STORAGE_KEY, normalized);
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, {
      detail: normalized,
    })
  );
  return normalized;
}

/**
 * Subscribes to library code change events across the app and storage tabs.
 */
export function onLibraryCodeChange(callback: (code: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustom = (e: Event) => {
    const custom = e as CustomEvent<string>;
    if (custom.detail) callback(custom.detail);
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      callback(e.newValue.toUpperCase());
    }
  };

  window.addEventListener(EVENT_NAME, handleCustom);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(EVENT_NAME, handleCustom);
    window.removeEventListener('storage', handleStorage);
  };
}

/**
 * Returns a 1-click shareable URL that automatically logs in another device.
 */
export function getShareableLibraryUrl(code: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/?code=${encodeURIComponent(code)}`;
}
