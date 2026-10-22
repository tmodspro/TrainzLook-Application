// Captures every app state the Remotion scenes need, from the real app in one session (see README.md).
// Env: MESH (a scratch COPY of the car's body.im: Replace writes backups beside it), LIVERY (an edited 1.jpg kept
// outside the mesh folder), plus the DX/DY/WHEEL camera of cam.mjs. (Merge is hidden in the app, so no import step.)
import { copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canvas, open, orbit, park, reload } from "./cam.mjs";

const OUT = fileURLToPath(new URL("../../public/captures", import.meta.url));
const { MESH, LIVERY } = process.env;

export default async function scenes(ctx) {
  const { send, evaluate, sleep, save } = ctx;
  const shot = async (name) => save(`${OUT}/${name}.png`, await canvas(evaluate));
  const at = (js) => evaluate(`(() => { const r = (${js}).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  const mouse = (type, [x, y], extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, ...extra });
  const click = async (js) => {
    const p = await at(js);
    await mouse("mouseMoved", p);
    await mouse("mousePressed", p, { button: "left", buttons: 1, clickCount: 1 });
    await mouse("mouseReleased", p, { button: "left", buttons: 0, clickCount: 1 });
  };
  const key = async (key, code, vk, modifiers = 0) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, modifiers });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, modifiers });
  };
  const notice = () => evaluate(`document.querySelector('.notice')?.textContent ?? ''`);
  const tile = (name) => `[...document.querySelectorAll('.tiles figure')].find(f => f.querySelector('figcaption')?.firstChild.textContent === ${JSON.stringify(name)})`;
  const thumb = async (name, file) => {
    const r = await evaluate(`(() => { const img = (${tile(name)}).querySelector('img'); img.scrollIntoView({ inline: 'nearest' }); const b = img.getBoundingClientRect(); return [b.x + 2, b.y + 2, b.width - 4, b.height - 4]; })()`);
    await sleep(300);
    const s = await send("Page.captureScreenshot", { format: "png", clip: { x: r[0], y: r[1], width: r[2], height: r[3], scale: 1 } });
    save(`${OUT}/${file}.png`, s.data);
  };

  // The file dialog never opens: its IPC request is answered here with `dialogPath`.
  let dialogPath = null;
  await send("Fetch.enable", { patterns: [{ urlPattern: "http://ipc.localhost/plugin%3Adialog%7Copen*", requestStage: "Request" }] });
  globalThis.__onEvent = (m) => {
    if (m.method !== "Fetch.requestPaused") return;
    const { requestId, request } = m.params;
    if (request.method !== "POST") return send("Fetch.continueRequest", { requestId });
    send("Fetch.fulfillRequest", {
      requestId,
      responseCode: 200,
      responseHeaders: [
        { name: "Tauri-Response", value: "ok" },
        { name: "Content-Type", value: "application/json" },
        { name: "Access-Control-Allow-Origin", value: "*" },
        { name: "Access-Control-Expose-Headers", value: "Tauri-Response" },
      ],
      body: Buffer.from(JSON.stringify(dialogPath)).toString("base64"),
    });
  };

  const data = {};
  await reload(ctx);
  await shot("tc1-empty");
  await open(ctx);
  await orbit(ctx);
  await shot("tc1-material");

  await mouse("mouseMoved", await at(`(${tile("1.jpg")}).querySelector('img')`));
  await sleep(400);
  await shot("tc1-highlight");
  await park(ctx);

  // Hot reload: overwrite 1.jpg on disk the way an image editor saves it.
  const target = join(dirname(MESH), "1.jpg");
  const orig = join(tmpdir(), "trainzlook-capture-1.jpg");
  copyFileSync(target, orig);
  copyFileSync(LIVERY, target);
  await sleep(3500);
  data.reload = await notice();
  await shot("tc1-livery");
  await thumb("1.jpg", "tex-1-livery");
  copyFileSync(orig, target);
  await sleep(3500);

  // Replace through the app (backup + conversion), then Ctrl+Z.
  dialogPath = LIVERY;
  await click(`[...(${tile("1.jpg")}).querySelectorAll('button')].find(b => b.textContent.startsWith('Replace'))`);
  await park(ctx);
  await sleep(3500);
  data.replace = await notice();
  await key("z", "KeyZ", 90, 2);
  await sleep(3500);
  data.revert = await notice();

  await click(`[...document.querySelectorAll('.area-header button')].find(b => b.textContent === 'Wireframe')`);
  await park(ctx);
  await sleep(400);
  await shot("tc1-wireframe");
  await click(`[...document.querySelectorAll('.area-header button')].find(b => b.textContent === 'Material')`);

  // UI text the mockup copies: the status bar and the Statistics overlay.
  Object.assign(data, await evaluate(`({
    status: document.querySelector('.status').textContent,
    stats: document.querySelector('.stats')?.innerText,
  })`));
  console.log(JSON.stringify(data, null, 1));
  const win = await send("Page.captureScreenshot", { format: "png" });
  save(join(tmpdir(), "trainzlook-capture-window.png"), win.data);
}
