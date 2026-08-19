# Image credits

The three case-study cover photos are from Unsplash and are served
first-party from `assets/` (they are no longer hotlinked, so no visitor
IP is disclosed to a third party). Used under the
[Unsplash License](https://unsplash.com/license).

| File | Source |
|---|---|
| `case-volvo-trucks.jpg` | https://unsplash.com/photos/1693359052846-df85e44a2ec1 |
| `case-volvo-cars.jpg` | https://unsplash.com/photos/1647427060118-4911c9821b82 |
| `case-regulated-ai.jpg` | https://unsplash.com/photos/1744640326166-433469d102f2 |

Each was downloaded from `images.unsplash.com/<id>?auto=format&fit=crop&w=900&q=80`
(900px wide, progressive JPEG) — the exact rendition the pages used to hotlink.
The `.webp` sibling of each file was then encoded locally from that JPEG through
Chromium (quality 0.80, ~40% smaller) and is offered first via `<picture>`; the
JPEG remains as the fallback. Hotlinking used to hand modern browsers a WebP via
Unsplash's `auto=format`, so this keeps that benefit while staying first-party.

**Source URLs above are constructed from the CDN id, not verified photo pages.**
The id is the one fact we hold: the images were fetched from
`https://images.unsplash.com/photo-<id>`. Automated lookup of the canonical photo
page is blocked (Unsplash serves a bot-check to non-browser clients and its
oEmbed endpoint now needs an API key), so the photographer must be identified by
searching Unsplash for the id from a normal browser.

**TODO:** add the photographer for each image. The Unsplash License does not
require attribution, but crediting the photographer is good practice.
