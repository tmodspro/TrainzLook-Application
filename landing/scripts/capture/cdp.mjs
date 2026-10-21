// Drives the TrainzLook dev window over the WebView2 DevTools protocol.
// usage: node cdp.mjs eval "<js expression>"            -> prints JSON result
//        node cdp.mjs shot <out.png> [x y w h] [scale]   -> page screenshot (CSS px clip)
//        node cdp.mjs metrics <w> <h> <dpr>              -> device metrics override
//        node cdp.mjs canvas <out.png>                   -> viewport canvas pixels
//        node cdp.mjs run <steps.mjs>                    -> default export (ctx) runs in ONE session (overrides persist)
import { writeFileSync } from "node:fs";

const targets = await (await fetch("http://127.0.0.1:9223/json")).json();
const page = targets.find((t) => t.type === "page" && t.url.includes("localhost:1420"));
if (!page) throw new Error("no TrainzLook page: " + JSON.stringify(targets.map((t) => t.url)));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  } else if (m.method) globalThis.__onEvent?.(m); // protocol events (e.g. Fetch.requestPaused) for step scripts
});
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};

const [cmd, ...a] = process.argv.slice(2);
if (cmd === "eval") console.log(JSON.stringify(await evaluate(a[0]), null, 1));
if (cmd === "metrics")
  await send("Emulation.setDeviceMetricsOverride", { width: +a[0], height: +a[1], deviceScaleFactor: +a[2], mobile: false });
if (cmd === "shot") {
  const [out, x, y, w, h, scale] = a;
  const clip = w ? { x: +x, y: +y, width: +w, height: +h, scale: +(scale ?? 1) } : undefined;
  const r = await send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: false });
  writeFileSync(out, Buffer.from(r.data, "base64"));
  console.log("wrote", out);
}
if (cmd === "run") {
  const steps = (await import(new URL(a[0], import.meta.url).href + "?" + Date.now())).default;
  await steps({ send, evaluate, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), save: (out, b64) => writeFileSync(out, Buffer.from(b64, "base64")) });
}
if (cmd === "canvas") {
  const url = await evaluate(
    "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(document.querySelector('.viewport canvas').toDataURL('image/png')))))",
  );
  writeFileSync(a[0], Buffer.from(url.split(",")[1], "base64"));
  console.log("wrote", a[0]);
}
ws.close();
