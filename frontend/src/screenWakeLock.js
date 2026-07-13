export function createScreenWakeLock({
  navigatorObject = globalThis.navigator,
  documentObject = globalThis.document,
} = {}) {
  let sentinel = null;
  let active = false;
  let listening = false;

  const acquire = async () => {
    if (
      !active ||
      sentinel ||
      !navigatorObject?.wakeLock?.request ||
      documentObject?.visibilityState !== 'visible'
    ) {
      return sentinel;
    }

    try {
      const acquired = await navigatorObject.wakeLock.request('screen');
      sentinel = acquired;
      acquired.addEventListener?.('release', () => {
        if (sentinel === acquired) sentinel = null;
      });
      return acquired;
    } catch {
      return null;
    }
  };

  const handleVisibilityChange = () => {
    if (documentObject?.visibilityState === 'visible') void acquire();
  };

  return {
    async start() {
      active = true;
      if (!listening) {
        documentObject?.addEventListener?.('visibilitychange', handleVisibilityChange);
        listening = true;
      }
      return acquire();
    },

    async stop() {
      active = false;
      if (listening) {
        documentObject?.removeEventListener?.('visibilitychange', handleVisibilityChange);
        listening = false;
      }
      const current = sentinel;
      sentinel = null;
      await current?.release?.();
    },
  };
}
