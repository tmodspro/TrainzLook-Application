# App captures

Viewport renders and Texture Browser thumbnails in `public/captures` come from the real TrainzLook app: the scripts
open the mesh through the app's own drag-drop handler and backend, at 2x pixel ratio, over WebView2 DevTools.

1. Start the app with DevTools on (repo root):
   `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223 npm run tauri dev`
2. Run a step script from this folder (`DX`/`DY` orbit, `WHEEL` zoom, `PX`/`PY` pan; the site uses `DX=35 DY=-20 WHEEL=14`):
   - `final.mjs`: material, highlight and wireframe renders plus every texture thumbnail. Env: `MESH`.
   - `scenes.mjs`: every state the Remotion scenes use (empty, hot-reloaded livery, Replace + Ctrl+Z, merge).
     Env: `MESH` (a **scratch copy** of the car: Replace writes backups beside it), `LIVERY` (edited `1.jpg`, kept outside
     the mesh folder), `IMPORT` (a static `.im`; animated ones are refused), optional `PLACE="x,y,z"`.
   - e.g. `MESH=… LIVERY=… IMPORT=… DX=35 DY=-20 WHEEL=14 node cdp.mjs run scenes.mjs`
3. Convert the PNGs to WebP with `sharp` (quality 85, thumbnails 80) and delete the PNGs.

Notes
- File dialogs never open: `scenes.mjs` answers the dialog's IPC request (`http://ipc.localhost/plugin%3Adialog%7Copen`)
  through the DevTools Fetch domain. Without that, a click on Replace/Import opens a real dialog on the desktop.
- Leave the mouse off the app window while a script runs: hover changes what the viewport draws.
- The unused-texture tile is drawn at 40% opacity and the mockup dims it again, so capture that one undimmed.
- Device-metrics overrides end with the DevTools session, so each script runs all its steps in one session.
