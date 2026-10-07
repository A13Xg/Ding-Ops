import { useEffect, useState } from 'react';
import { installState } from './pwaInstall.js';

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = event => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const state = installed
    ? { kind: 'installed', label: 'INSTALLED' }
    : installState({ hasNativePrompt: Boolean(deferredPrompt) });

  async function install() {
    if (!deferredPrompt) return { ok: false, state };
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice?.outcome === 'accepted') setDeferredPrompt(null);
    return { ok: choice?.outcome === 'accepted', outcome: choice?.outcome || 'dismissed' };
  }

  return { ...state, install };
}
