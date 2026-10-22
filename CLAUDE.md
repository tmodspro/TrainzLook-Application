@AGENTS.md

# TrainzLook

- Format specs live in `docs/01-reverse-engineering.md`; roadmap in `docs/02-rancangan-dan-roadmap.md`; landing page plan in `docs/03-landing-page.md` (site lives in `landing/`, never mixed with `app/`).
- Never commit payware sample assets (e.g. Indorails TKK-8500 meshes/textures). Tests build synthetic meshes in code.
- Exception approved by the user (2026-10-21): app renders and Texture Browser thumbnails of TKK-8500 (TC1-8500, plus a hue-shifted demo livery) in `landing/public/captures` for the landing page. Still no `.im`, `.texture.txt` or full-size texture files.
