import { ref } from 'vue';

export type OfflineReadiness = 'checking' | 'ready' | 'unavailable';
export const offlineReadiness = ref<OfflineReadiness>('checking');
let attempt = 0;

/** Ready means the installed worker has cached the shell and controls this page. */
export async function prepareOfflineApp(
  serviceWorkers: ServiceWorkerContainer | undefined,
  workerUrl: string,
  timeoutMs = 12_000,
): Promise<void> {
  const current = ++attempt;
  offlineReadiness.value = 'checking';
  if (!serviceWorkers) {
    offlineReadiness.value = 'unavailable';
    return;
  }
  try {
    const registration = await serviceWorkers.register(workerUrl);
    if (!serviceWorkers.controller) {
      await new Promise<void>((resolve, reject) => {
        const installing = registration.installing;
        let timer: ReturnType<typeof setTimeout>;
        const cleanup = () => {
          clearTimeout(timer);
          serviceWorkers.removeEventListener('controllerchange', onController);
          installing?.removeEventListener('statechange', onWorkerState);
        };
        const onController = () => {
          if (!serviceWorkers.controller) return;
          cleanup();
          resolve();
        };
        const onWorkerState = () => {
          if (installing?.state !== 'redundant' || serviceWorkers.controller) return;
          cleanup();
          reject(new Error('Offline setup failed'));
        };
        serviceWorkers.addEventListener('controllerchange', onController);
        installing?.addEventListener('statechange', onWorkerState);
        timer = setTimeout(() => { cleanup(); reject(new Error('Offline setup timed out')); }, timeoutMs);
        // A controller or failed installer may have appeared while attaching listeners.
        onController();
        if (!serviceWorkers.controller) onWorkerState();
      });
    }
    if (current === attempt) offlineReadiness.value = 'ready';
  } catch {
    if (current === attempt) offlineReadiness.value = 'unavailable';
  }
}
