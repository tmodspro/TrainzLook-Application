import { fileURLToPath } from "node:url";
import { setup, canvas } from "./cam.mjs";
const OUT = fileURLToPath(new URL("../../public/captures", import.meta.url));
export default async function capture(ctx) {
  const { send, evaluate, sleep, save } = ctx;
  await setup(ctx);
  const rect = (js) => evaluate(`(() => { const r = (${js}).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  const move = async ([x, y]) => send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  const click = async ([x, y]) => {
    await move([x, y]);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
  };

  save(`${OUT}/tc1-material.png`, await canvas(evaluate));

  // Hover the body-side texture tile: the app tints every part that uses it.
  await move(await rect(`document.querySelector('[data-path$="1.jpg" i] img, [data-path$="\\1.jpg" i] img') || [...document.querySelectorAll('figure')].find(f => f.querySelector('figcaption').firstChild.textContent === '1.jpg')`));
  await sleep(400);
  save(`${OUT}/tc1-highlight.png`, await canvas(evaluate));
  await move([700, 860]);

  await click(await rect(`[...document.querySelectorAll('.area-header button')].find(b => b.textContent === 'Wireframe')`));
  await move([700, 860]);
  await sleep(400);
  save(`${OUT}/tc1-wireframe.png`, await canvas(evaluate));
  await click(await rect(`[...document.querySelectorAll('.area-header button')].find(b => b.textContent === 'Material')`));
  await move([700, 860]);
  await sleep(300);

  // Texture thumbnails as the Texture Browser draws them (124 CSS px at 2x).
  const names = await evaluate(`[...document.querySelectorAll('.tiles figure:not(.missing)')].map(f => f.querySelector('figcaption').firstChild.textContent)`);
  for (const [i, name] of names.entries()) {
    const r = await evaluate(`(() => { const img = document.querySelectorAll('.tiles figure:not(.missing)')[${i}].querySelector('img'); img.scrollIntoView({ inline: 'nearest' }); const b = img.getBoundingClientRect(); return [b.x + 2, b.y + 2, b.width - 4, b.height - 4]; })()`);
    await sleep(300);
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: r[0], y: r[1], width: r[2], height: r[3], scale: 1 } });
    save(`${OUT}/tex-${name.replace(/\.[^.]+$/, "")}.png`, shot.data);
  }

  const data = await evaluate(`({
    parts: [...document.querySelectorAll('.outliner ul:first-of-type li')].filter(li => li.querySelector('.material')).map(li => li.textContent),
    attachments: [...document.querySelectorAll('.outliner li')].filter(li => li.querySelector('.attachment')).map(li => li.textContent),
    issues: [...document.querySelectorAll('.issues li')].map(li => [li.querySelector('.dot').className, li.textContent]),
    tiles: [...document.querySelectorAll('.tiles figure')].map(f => [f.className, f.querySelector('figcaption').textContent]),
    status: document.querySelector('.status').textContent,
  })`);
  console.log(JSON.stringify(data, null, 1));
}
