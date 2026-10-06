# Vercel deployment

The optimized `.glb` files are tracked by Git LFS (`.gitattributes` applies `filter=lfs` to `*.glb`). Vercel must fetch the LFS objects when building the deployment. In the Vercel project, open **Settings → Git → Git Large File Storage (LFS)**, enable it, then redeploy the latest commit. Vercel documents that it pulls LFS objects when this setting is enabled and requires a redeploy after changing it: https://vercel.com/docs/project-configuration/git-settings#git-large-file-storage-lfs.

Keep the Vercel project root at the repository root. The Vite build command is `npm run build` and the output directory is `dist`. `vercel.json` rewrites application routes such as `/trainer`, `/room`, and `/aar/:sessionId` to the SPA entry while Vercel serves existing static assets, including `/assets/**/*.glb`, directly.

To diagnose a deployment, open DevTools → Network, reload the scene and inspect one failed `.glb` request:

- **404:** verify the project root/output directory and that the requested file exists in the deployment's static assets.
- **200 but the first bytes spell `version https://git-lfs.github.com/spec/v1`:** Vercel deployed the LFS pointer rather than the model; enable Vercel Git LFS and redeploy.
- **200 but the response starts with HTML:** the model URL was rewritten to the SPA page; verify the static asset path and deployment output.
- **200 with `glTF` as the first four bytes:** the model bytes arrived; inspect the console for GLB parsing, unsupported extensions, or GPU memory errors.

In the browser console, this checks the actual response without downloading it to disk:

```js
fetch('/assets/regions/shakti-punjab/terrain.glb').then(async response => {
  const bytes = new Uint8Array(await response.arrayBuffer());
  console.log({ status: response.status, type: response.headers.get('content-type'), size: bytes.length, signature: new TextDecoder().decode(bytes.slice(0, 4)) });
});
```

The expected signature is `glTF`. Repeat the check for an aircraft at `/assets/drones/fpv.glb` and a building at `/assets/environment/booth.glb`. The regional terrain, drone catalogue and environment modules are separate requests; a single missing family can make different 3D views report related loader errors.
