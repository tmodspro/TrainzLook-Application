import { invoke } from "@tauri-apps/api/core";

// JPEG decodes natively in the webview; PNG/TGA/BMP go through Rust so TGA works and alpha is known.
export const isJpeg = (path: string) => /\.jpe?g$/i.test(path);

export const REPLACE_EXTS = ["jpg", "jpeg", "png", "tga", "bmp"];

/** RGBA rows top to bottom, as laid out by `decode_image` in app/src-tauri/src/lib.rs. */
export async function decodeImage(path: string, max?: number, before?: boolean) {
  const buf = await invoke<ArrayBuffer>("decode_image", { path, max, before });
  const [width, height, alpha] = new Uint32Array(buf, 0, 3);
  return { width, height, alpha: alpha === 1, data: new Uint8Array(buf, 12) };
}
