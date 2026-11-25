# Image credits

## Generated pictures (English home page)

Made on 25 November 2026 with ElevenLabs' image tools, in the flow "Vynatix home page pictures,
premium set (4K)", where the 4K masters and the candidates not chosen remain. Each slot was
generated four times with each of two models at 4K, and the best of the eight kept: the Services
picture, the regulated client and Volvo Cars with `gpt-image-2.6-sunburst` (quality high), Volvo
Trucks with `flux-3-image`. Each night version was made by editing its daylight picture with
`gpt-image-2.6-sunburst` at 4K, so the two match. No photograph was used, and no person, brand or
client system is shown: the prompts described a studio, a desk and a truck cab, asked for no logos,
and named no company. The truck cab is not a Volvo's, the car body is unbadged, and the screens
show no client software. The one readable screen says "Build passed" and "6 min", the figure of
the Volvo Cars case.

| File (and its `-dark` twin) | Where on the home page | What it shows |
|---|---|---|
| `services-bench.webp` | Services, one picture across the three columns | An oak bench with a laptop and a GPU board, a small server rack, and a phone, a tablet and a watch |
| `case-ai-cited-answer.webp` | Cases, the regulated client card | Three binders and an open document with a highlighted passage, beside a laptop whose assistant answers with two numbered sources; a harbour crane in the window |
| `case-cars-build-passed.webp` | Cases, the Volvo Cars card | A portrait monitor reading "Build passed" and "6 min" over ten stages with green checks; a car body on a lift beyond the glass |
| `case-trucks-cab-player.webp` | Cases, the Volvo Trucks card | A truck cab on a forest road, a media player on its centre screen |

The Services files are 3072 by 1024 (quality 80), the regulated client's 2000 by 1333 (quality
78), the Volvo files 1600 square (quality 82): twice the largest size each is shown at.

A second set, made the same day with `bytedance-seedream-5-pro` at 2K (`services-workbench`,
`case-ai-source-documents`, `case-cars-build-pipeline`, `case-trucks-cab-media`), was on the
branch for a few hours and replaced by this one before it was published; it is in the repository's
history.

They replaced the first generated set of 20 November 2026 (`services-drafting-sheet`,
`case-ai-bound-documents`, `case-cars-stopwatch`, `case-trucks-radio-dial`, made with
`gpt-image-2.5-sunburst`: still lifes of brass instruments on a drafting sheet), which the owner
had removed because it looked AI-generated and out of context. Those files are in the
repository's history.

## Photographs (Swedish hub)

The three photographs on the Swedish hub (`sv.html`; they were on the English home page too
until 20 November 2026) are from Unsplash and are served
first-party from `assets/` (they are not hotlinked, so no visitor IP is
disclosed to a third party). Used under the
[Unsplash License](https://unsplash.com/license).

| File | Where on the home page | Photographer | Source |
|---|---|---|---|
| `case-trucks-forest-road.jpg` | Cases, the Volvo Trucks card | Roberto Hanas | https://unsplash.com/photos/gray-cargo-truck-on-road-during-daytime-cJKUzAgHwpA |
| `case-ai-archive-volumes.jpg` | Cases, the regulated client card | Anna Auza | https://unsplash.com/photos/a-group-of-white-signs-on-a-metal-rack-FuFaLog6qN0 |
| `case-cars-marshalling-yard.jpg` | Cases, the Volvo Cars card | Patrick Federi | https://unsplash.com/photos/an-aerial-view-of-a-highway-with-multiple-lanes-RshUMrKap-0 |

Each was downloaded on 16 November 2026 through Unsplash's download endpoint (which
records the download for the photographer) at 2000px wide, then resized to 1200px
wide and saved as a progressive JPEG (quality 80; the marshalling yard at 68,
because its fine detail is costly) and as a WebP sibling (quality 78; the yard at
62). `sv.html` offers the WebP first via `<picture>` and keeps the JPEG as the
fallback.

**What was changed in a photograph.**

- `case-trucks-forest-road`: the haulier's name on the truck's sun visor and its
  number plate were blurred out. Neither is a Vynatix client, and a third party's
  name has no place on a case cover. The Volvo mark on the grille is left as it
  was; Volvo Trucks is named on the page with consent (see *Client marks*).
- The other two are resized only.

**These are illustrations, not pictures of client work.** The truck is a Volvo, but
it is not shown to carry the software in the case; the archive and the marshalling
yard are analogies. The home page says so in the line under the case cards.

The Unsplash License does not require attribution; the page credits the
photographers anyway, in that line.

Two more photographs were on the home page until 19 November 2026, when the content
plan took their sections off it: `photo-balance-weights` (Angelo Casto,
https://unsplash.com/photos/a-scale-with-a-bowl-on-top-of-it-i0OUCubcdMU) and
`photo-gothenburg-canal` (Claudio Schwarz,
https://unsplash.com/photos/a-river-running-through-a-city-next-to-tall-buildings-787vVS9UD7Q).
Their files were removed with the sections; they are in the repository's history.

The three covers these replaced (`case-volvo-trucks`, `case-volvo-cars`,
`case-regulated-ai`) were removed on the same day; their photographers were never
identified.

## Client marks

The Volvo iron mark in the client strip on the home page is inlined as an SVG
`<symbol>` in `index.html` (one definition, reused with `<use>`, so it follows
the text colour in both themes). It is not a separate file in `assets/`.

| Mark | Source |
|---|---|
| Volvo iron mark | https://commons.wikimedia.org/wiki/File:Volvo-Iron-Mark-Black.svg |

### Client wordmarks

The client strip on the home page shows the wordmarks of the companies listed
below. Each is shown as a single-colour silhouette, made from the logo file
named in the table (`assets/clients/mono/<name>.png`, trimmed to its shape, with
the original colours removed) so it takes the text colour in every theme. The
full-colour originals are kept in `assets/clients/` for reference.

Permission to name each company and show its wordmark is recorded here as the
site owner's confirmation (Vynatix AB) at the time of the change. Each wordmark
belongs to its company and its trademark is theirs.

| Client | Original file | Downloaded from |
|---|---|---|
| Agnhaga | `assets/clients/agnhaga.png` | https://ultragroup.se/wp-content/uploads/2024/01/AGN_Haga.png |
| Aurobay | `assets/clients/aurobay.png` | https://ultragroup.se/wp-content/uploads/2023/08/AUROBAY.png |
| CEVT | `assets/clients/cevt.png` | https://ultragroup.se/wp-content/uploads/2023/09/CEVT.png |
| Magna | `assets/clients/magna.png` | https://ultragroup.se/wp-content/uploads/2023/12/Magna.png |
| Saab | `assets/clients/saab.png` | https://ultragroup.se/wp-content/uploads/2023/12/SAAB.png |
| Scania | `assets/clients/scania.png` | https://ultragroup.se/wp-content/uploads/2024/07/scania.png |
| Sony | `assets/clients/sony.png` | https://ultragroup.se/wp-content/uploads/2023/11/SONY2-e1700661614744.png |
| Swisslog | `assets/clients/swisslog.png` | https://ultragroup.se/wp-content/uploads/2023/09/Swisslog.png |
| Tele2 | `assets/clients/tele2.png` | https://ultragroup.se/wp-content/uploads/2023/09/Tele2.png |
| Veoneer | `assets/clients/veoneer.png` | https://ultragroup.se/wp-content/uploads/2023/11/veoneer2-e1700125544715.png |
| Volvo Buses | `assets/clients/volvo-buses.png` | https://ultragroup.se/wp-content/uploads/2023/12/v-buses__1_-removebg-preview.png |
| Volvo Penta | `assets/clients/volvo-penta.png` | https://ultragroup.se/wp-content/uploads/2023/12/penta.png |

The originals were taken from the logo row on the Ultra Group website, which
lists these companies. Their source is the company's own logo file, not a
Vynatix asset.

Wikimedia Commons lists the file as public domain (the mark is too simple for
copyright), uploaded from Volvo Group's own logotype set. Copyright is not the
point, though: **the iron mark is a registered trademark of the Volvo
companies.** Showing it as "a client we have worked with" is ordinary
nominative use, but each client's brand guidelines and the contracts under
which the work was done decide whether the mark may appear here at all. Get the
client's consent before adding any further mark, and take a mark down if a
client asks.

## Fonts

The faces are the Vynatix Design System's, self-hosted as woff2 subsets made
with fontTools from the system's TTF files (see the root `AGENTS.md`):

| Family | Licence | Files |
|---|---|---|
| Fraunces (variable, upright and italic) | SIL OFL 1.1 | `fonts/fraunces-*.woff2` |
| Aptos (300, 400, 600, 700, italics) | Microsoft; terms to be confirmed for web use | `fonts/aptos-*.woff2` |
| Geist (variable) | SIL OFL 1.1 | `fonts/geist-variable.woff2` |
| Instrument Serif (regular, italic) | SIL OFL 1.1 (`fonts/licences/`) | `fonts/instrument-serif-*.woff2` |
| JetBrains Mono (400, 500, 700, italic) | SIL OFL 1.1 (`fonts/licences/`) | `fonts/jetbrains-mono-*.woff2` |

## Icons

Material Symbols Outlined, Apache License 2.0 (Google), `assets/icons/LICENSE.txt`.
The SVG files are from `@material-symbols/svg-300` 0.47.5 via the design system.
