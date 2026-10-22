import { useEffect, useState } from "react";

export type MenuItem =
  | { label: string; shortcut?: string; disabled?: boolean; checked?: boolean; title?: string; onSelect: () => void }
  | { heading: string }
  | "sep";
/** A title with items opens a dropdown; one with `onSelect` acts at once (e.g. opens a dialog). */
export type Menu = { label: string; items: MenuItem[] } | { label: string; onSelect: () => void };

/** Blender-style text menus: click opens, hovering another title while one is open switches to it, Esc or a click
 * outside closes. */
export default function Menubar({ menus }: { menus: Menu[] }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const close = () => setOpen(null);
    window.addEventListener("keydown", esc);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("keydown", esc);
      window.removeEventListener("blur", close);
    };
  }, [open]);

  return (
    <div className="menubar" role="menubar">
      {/* catches the click that closes the menu, so it never also presses whatever lies under it */}
      {open !== null && <div className="menu-veil" onPointerDown={() => setOpen(null)} />}
      {menus.map((m, i) => (
        <div key={m.label} className="menu">
          <button
            role="menuitem"
            aria-haspopup={"items" in m ? "menu" : "dialog"}
            aria-expanded={"items" in m ? open === i : undefined}
            className={open === i ? "open" : ""}
            onClick={() => {
              if ("items" in m) return setOpen(open === i ? null : i);
              setOpen(null);
              m.onSelect();
            }}
            onMouseEnter={() => open !== null && setOpen("items" in m ? i : null)}
          >
            {m.label}
          </button>
          {open === i && "items" in m && (
            <div className="menu-list" role="menu">
              {m.items.map((it, k) =>
                it === "sep" ? (
                  <hr key={k} />
                ) : "heading" in it ? (
                  <div key={k} className="menu-heading">
                    {it.heading}
                  </div>
                ) : (
                  <button
                    key={k}
                    role={it.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                    aria-checked={it.checked}
                    disabled={it.disabled}
                    title={it.title}
                    onClick={() => {
                      setOpen(null);
                      it.onSelect();
                    }}
                  >
                    <span className="check">{it.checked ? "✓" : ""}</span>
                    <span className="label">{it.label}</span>
                    {it.shortcut && <kbd>{it.shortcut}</kbd>}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
