export function isStandalonePwa(win = globalThis.window, nav = globalThis.navigator) {
  return Boolean(
    win?.matchMedia?.('(display-mode: standalone)')?.matches ||
      nav?.standalone === true
  );
}

export function isIosDevice(nav = globalThis.navigator) {
  const ua = String(nav?.userAgent || '');
  const platform = String(nav?.platform || '');
  return /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && Number(nav?.maxTouchPoints || 0) > 1);
}

export function installState({ win = globalThis.window, nav = globalThis.navigator, hasNativePrompt = false } = {}) {
  if (isStandalonePwa(win, nav)) return { kind: 'installed', label: 'INSTALLED' };
  if (hasNativePrompt) return { kind: 'prompt', label: 'INSTALL DING' };
  if (isIosDevice(nav)) return { kind: 'ios-manual', label: 'INSTALL ON IPHONE/IPAD' };
  return { kind: 'unavailable', label: 'INSTALL UNAVAILABLE' };
}
