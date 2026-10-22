import { useEffect, useState, type RefObject } from "react";
import { getVersion } from "@tauri-apps/api/app";
import logo from "./logo.svg";

// The Rust `open_link` command only accepts these URLs; keep both lists in step.
const ROWS = [
  ["Website", "trainzlook.web.id", "https://trainzlook.web.id"],
  ["Author", "Nolan Anggaran", "https://www.facebook.com/nolanagrn"],
  ["Publisher", "INDORAILS", "https://indorails.my.id/"],
] as const;

/** "Bantuan" popup: what TrainzLook is, who makes it, where to find more. */
export default function About({
  dialog,
  openLink,
}: {
  dialog: RefObject<HTMLDialogElement | null>;
  openLink: (url: string) => void;
}) {
  const [version, setVersion] = useState("");
  useEffect(() => {
    getVersion().then(setVersion, () => setVersion(""));
  }, []);

  return (
    <dialog ref={dialog} className="modal about" aria-labelledby="about-title">
      <img src={logo} alt="" />
      <h3 id="about-title">TrainzLook</h3>
      <p className="muted">{version && `Versi ${version} · `}Viewer & editor mesh Trainz (.im)</p>
      <dl>
        {ROWS.map(([label, text, url]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <button className="link" title={url} onClick={() => openLink(url)}>
                {text}
              </button>
            </dd>
          </div>
        ))}
      </dl>
      <p className="muted small">Copyright © 2026 INDORAILS. All rights reserved.</p>
      <button className="on" autoFocus onClick={() => dialog.current?.close()}>
        Tutup
      </button>
    </dialog>
  );
}
