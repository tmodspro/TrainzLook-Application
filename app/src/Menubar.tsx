import { useEffect, useState } from "react";

export type MenuItem =
  | { label: string; shortcut?: string; disabled?: boolean; checked?: boolean; title?: string; onSelect: () => void }
  | { heading: string }
  | "sep";
export type Menu = { label: string; items: MenuItem[] };

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
            aria-haspopup="menu"
            aria-expanded={open === i}
            className={open === i ? "open" : ""}
            onClick={() => setOpen(open === i ? null : i)}
            onMouseEnter={() => open !== null && setOpen(i)}
          >
            {m.label}
          </button>
          {open === i && (
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
