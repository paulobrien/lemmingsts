import { describe, expect, it, vi } from 'vitest';
import { offlineReadiness, prepareOfflineApp } from '../../src/offline-readiness';

class FakeWorkers extends EventTarget {
  controller: object | null = null;
  installing = Object.assign(new EventTarget(), { state: 'installing' });
  register = vi.fn(async () => ({ installing: this.installing }));
}

describe('offline readiness', () => {
  it('reports ready only once the installed worker controls the page', async () => {
    const workers = new FakeWorkers();
    const pending = prepareOfflineApp(workers as unknown as ServiceWorkerContainer, '/sw.js');
    await Promise.resolve();
    expect(offlineReadiness.value).toBe('checking');
    workers.controller = {};
    workers.dispatchEvent(new Event('controllerchange'));
    await pending;
    expect(workers.register).toHaveBeenCalledWith('/sw.js');
    expect(offlineReadiness.value).toBe('ready');
  });

  it('reports unavailable for unsupported browsers and failed installations', async () => {
    await prepareOfflineApp(undefined, '/sw.js');
    expect(offlineReadiness.value).toBe('unavailable');
    const workers = new FakeWorkers();
    const pending = prepareOfflineApp(workers as unknown as ServiceWorkerContainer, '/sw.js');
    await Promise.resolve();
    workers.installing.state = 'redundant';
    workers.installing.dispatchEvent(new Event('statechange'));
    await pending;
    expect(offlineReadiness.value).toBe('unavailable');
  });

  it('does not keep promising offline readiness when activation never completes', async () => {
    vi.useFakeTimers();
    try {
      const workers = new FakeWorkers();
      const pending = prepareOfflineApp(workers as unknown as ServiceWorkerContainer, '/sw.js', 100);
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(100);
      await pending;
      expect(offlineReadiness.value).toBe('unavailable');
    } finally {
      vi.useRealTimers();
    }
  });
});
