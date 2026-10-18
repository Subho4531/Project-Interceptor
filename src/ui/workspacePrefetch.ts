/**
 * Warms the code-split 3D workspace bundles (ground observer, command room) so the
 * route Suspense fallback disappears after training starts. Module-scope idempotent:
 * the loader thunks are the exact ones `Routes.tsx` hands to React.lazy, so the
 * warmed module graph is the same one the routes mount later.
 */
const workspaceLoaders = [
  () => import('./App'),
  () => import('./CommandRoomRoute'),
] as const;

let workspaceBundles: Promise<void> | undefined;

export function prefetchWorkspaceBundles(): Promise<void> {
  workspaceBundles ??= Promise.allSettled(workspaceLoaders.map(loader => loader())).then(() => {});
  return workspaceBundles;
}
