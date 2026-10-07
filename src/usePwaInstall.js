import { useEffect, useMemo, useState } from 'react';
import { installState } from './pwaInstall.js';

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installedTick, setInstalledTick] = useState(0);

  useEffect(() => {
    const onBeforeInstall = event => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setInstalledTick(value => value + 1);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const state = useMemo(
    () => installState({ hasNativePrompt: Boolean(deferredPrompt) }),
    [deferredPrompt, installedTick]
  );

  async function install() {
    if (!deferredPrompt) return { ok: false, state };
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice?.outcome === 'accepted') setDeferredPrompt(null);
    return { ok: choice?.outcome === 'accepted', outcome: choice?.outcome || 'dismissed' };
  }

  return { ...state, install };
}
