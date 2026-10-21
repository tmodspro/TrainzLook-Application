// Shared steps: reload the app at 2x, open a mesh through the app's own drag-drop handler, orbit/zoom with real
// mouse input (DX/DY orbit, WHEEL zoom, PX/PY pan from the environment), and read back the viewport canvas.
export const MESH = process.env.MESH; // a .im path, forward slashes
const cx = 821, cy = 334; // viewport centre in CSS px

export async function reload({ send, sleep }) {
  await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 869, deviceScaleFactor: 2, mobile: false });
  await send("Page.reload");
  await sleep(4000);
}

export async function open({ evaluate, sleep }, path = MESH) {
  await evaluate(`window.__TAURI_INTERNALS__.invoke('plugin:event|emit', {event:'tauri://drag-drop', payload:{paths:[${JSON.stringify(path)}], position:{x:0,y:0}}})`);
  await sleep(8000);
}

export async function orbit({ send, sleep }) {
  const m = (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, ...extra });
  const dx = +(process.env.DX ?? 0), dy = +(process.env.DY ?? 0);
  if (dx || dy) {
    await m("mouseMoved", cx, cy);
    await m("mousePressed", cx, cy, { button: "left", buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 10; i++) await m("mouseMoved", cx + (dx * i) / 10, cy + (dy * i) / 10, { button: "left", buttons: 1 });
    await m("mouseReleased", cx + dx, cy + dy, { button: "left", buttons: 0, clickCount: 1 });
  }
  for (let i = 0; i < +(process.env.WHEEL ?? 0); i++) await m("mouseWheel", cx, cy, { deltaX: 0, deltaY: -100 });
  const px = +(process.env.PX ?? 0), py = +(process.env.PY ?? 0);
  if (px || py) {
    await m("mousePressed", cx, cy, { button: "right", buttons: 2, clickCount: 1 });
    for (let i = 1; i <= 10; i++) await m("mouseMoved", cx + (px * i) / 10, cy + (py * i) / 10, { button: "right", buttons: 2 });
    await m("mouseReleased", cx + px, cy + py, { button: "right", buttons: 0, clickCount: 1 });
  }
  await park({ send });
  await sleep(500);
}

// Pointer on the status bar: no hover states in the capture.
export const park = ({ send }) => send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 700, y: 860 });

export async function setup(ctx) {
  await reload(ctx);
  await open(ctx);
  await orbit(ctx);
}

export const canvas = (evaluate) =>
  evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(document.querySelector('.viewport canvas').toDataURL('image/png').split(',')[1]))))");
