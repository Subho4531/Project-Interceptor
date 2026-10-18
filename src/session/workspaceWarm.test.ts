import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionController, WORKSPACE_WARM_URLS } from './SessionController';

// The controller-level workspace warm preloads observer/command-room extras through
// the same byte cache the renderers read; failures must degrade to 'partial' without
// blocking the strict regional/simulation readiness gate.
describe('workspace warm preload', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('declares exactly the shared observer and command-room extras', () => {
    expect(WORKSPACE_WARM_URLS).toEqual(['./assets/environment/ground-normal.jpg', './assets/environment/sky.hdr', './assets/command-room/room.glb']);
  });

  it('resolves partial when the optional assets fail and stays idempotent', async () => {
    vi.stubGlobal('document', { baseURI: 'http://127.0.0.1/' });
    let httpCalls = 0;
    vi.stubGlobal('fetch', (async () => { httpCalls++; return new Response('stub', { status: 404 }); }));
    const controller = new SessionController();
    expect(await controller.workspaceWarm()).toBe('partial');
    // A resolved promise is retained: retrying the warm never re-issues the network calls.
    expect(await controller.workspaceWarm()).toBe('partial');
    expect(httpCalls).toBe(WORKSPACE_WARM_URLS.length);
  });

  it('does not claim the strict regional gate is ready from a warm alone', async () => {
    vi.stubGlobal('document', { baseURI: 'http://127.0.0.1/' });
    vi.stubGlobal('fetch', (async () => new Response('stub', { status: 404 })));
    const controller = new SessionController();
    await controller.workspaceWarm();
    const snapshot = controller.getSnapshot();
    expect(snapshot.assetsReady).toBe(false);
    expect(snapshot.loadState).toBe('idle');
  });
});
