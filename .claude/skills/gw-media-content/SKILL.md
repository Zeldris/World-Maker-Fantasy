---
name: gw-media-content
description: "Prepare unpublished social-media and website posts, with images, for a project update. Use when the user asks for posts, a thread, an announcement or media content about an update, names a channel (X/Twitter, LinkedIn, Reddit, Discord, the project website), or wants an update folder created or topped up."
license: MIT
compatibility: "Needs Python 3, Node with Playwright and ImageMagick (convert with WebP) for the media step."
metadata:
  version: "0.2.0"
  source: "Galivelop workshop"
---

You prepare **unpublished** content for one project update: texts per channel plus the images that go with them
(cards, diagrams, screenshots). Nothing gets posted; the user publishes and records where.

The project's own rules (folder, languages, sources, channel tone) live in its docs: read them first, they win over
this file. In World-Maker-Fantasy: [`docs/difusion/README.md`](../../../docs/difusion/README.md),
[`guia-canales.md`](../../../docs/difusion/guia-canales.md) and the project note
[`.claude/gw/gw-media-content.md`](../../gw/gw-media-content.md) (screenshot scenarios, palette, gotchas).

## Steps

1. **Scope.** From the request: which update (a merged feature, a test round, lore, a release) and which channels.
   No channel named → all of them. Done when you can name the update folder and the channel list.
2. **Folder.** An update is `docs/difusion/AAAA-MM-DD-<tema>/` (date of what is told).
   - New: `cp -r docs/difusion/_plantilla docs/difusion/AAAA-MM-DD-<tema>`, then delete the channel files not
     requested. `ficha.md` always stays.
   - Existing: read its `ficha.md` table «Publicado». A channel already published is left alone; you add only what is
     unpublished (a new channel, a missing language, a follow-up post marked as such).
3. **Facts first: `ficha.md`.** Every number, name and claim, in player language and technical language, with its
   source (roadmap entry, PR description, ADR, canon file). Only what is merged in `main`; lore only from the canon.
   Done when each fact a channel will use has a source cell.
4. **Media.** Every channel that carries an image gets one that exists in `medios/`, with alt text in every language.
   - **Card** (headline + 3 figures) and **diagram** (4-step flow): copy `medios/fuente/tarjeta.html` /
     `diagrama.html` to `<name>.es.html` and `<name>.en.html`, fill every `{{…}}`, delete the unused template.
   - **Screenshot** of the running app: steps in the project note. Crop to what matters, save as `.jpg` (quality
     ~88) in `medios/fuente/`. No personal save data, no placeholder or broken text on screen.
   - **Published images** (the website's own): link them; never copy them into the folder.
   - Render: `node .claude/skills/gw-media-content/scripts/render.mjs docs/difusion/<folder>` writes
     `medios/<name>.webp` (≤1600 px) and `<name>-mini.webp` (720 px) for each source. Look at each WebP before
     using it (Read the file).
   - List each image in the ficha table `## Imágenes`: file, alt text `es / en`, channels.
5. **Channels.** Write each requested file in every language, from the ficha only, following the channel guide
   (length, tone, hashtags, link position). Each post names its image line (`Imagen: medios/<name>.webp`).
6. **Check.** `python3 .claude/skills/gw-media-content/scripts/comprobar.py docs/difusion/<folder>` prints `OK`.
   It catches template gaps, internal jargon (task ids, finding numbers, branch names), X posts over 280, a broken
   `web.md` JSON, images missing, unrendered or unlisted. Then reread the English: natural, not a literal
   translation.
7. **Commit** with the project's commit format; the log row says the folder is ready to publish and which channels.

## Updating the templates

Change `docs/difusion/_plantilla/` (texts and `medios/fuente/*.html`) and `comprobar.py` together: the checker is
the contract for what a finished folder looks like.
