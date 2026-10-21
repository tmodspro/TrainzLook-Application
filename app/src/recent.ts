// Recently opened meshes, newest first. Kept in the webview's localStorage: a per-user convenience, so losing it is harmless.
const KEY = "trainzlook.recent";
const MAX = 10;

export function readRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((p): p is string => typeof p === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function saveRecent(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage blocked or full: the list just isn't remembered
  }
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase(); // Windows paths ignore case

/** `path` moved to the front, without duplicates, capped at MAX. */
export const pushRecent = (list: string[], path: string) => [path, ...list.filter((p) => !same(p, path))].slice(0, MAX);

export const dropRecent = (list: string[], path: string) => list.filter((p) => !same(p, path));

if (import.meta.env.DEV) {
  const l = pushRecent(pushRecent(["C:\\a.im", "C:\\b.im"], "C:\\B.im"), "C:\\c.im");
  console.assert(l.join() === "C:\\c.im,C:\\B.im,C:\\a.im", "pushRecent dedupes case-insensitively, newest first", l);
  console.assert(pushRecent(Array.from({ length: 12 }, (_, i) => `${i}.im`), "x.im").length === MAX, "pushRecent caps the list");
  console.assert(dropRecent(l, "c:\\A.IM").length === 2, "dropRecent ignores case");
}
