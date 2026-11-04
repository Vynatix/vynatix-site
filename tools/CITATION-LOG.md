# Citation log and the pilot's decision rule

Not published (`tools/` is excluded in `_config.yml`), but the repository is public: **record counts and facts
about pages only, never the identity of anyone who wrote in, and keep screenshots outside the repository** (they
show the tester's account, locale and profile; the Screenshot column holds a file name or reference only).
Analytics are off, so every signal here is a floor.

Open question for counsel, to settle before the first post goes live on `main`: the guide's call to action says
the subject line names the guide so we know which page was read, while the privacy notice says there is no other
analytics. Do the notices cover per-page attribution of a voluntary email subject, or does the email section need
a purpose line? (`AGENTS.md`, "Posts, permanence and withdrawal".)

## What this can and cannot show

- A logged citation proves a page **can** be cited (a one-sided existence proof). A genuine tagged enquiry proves
  the call to action works. Persistent absence on the control pages and the pilot alike points to a discovery
  problem (the site is not indexed or not yet trusted), not to weak content.
- It **cannot** rank pages, compare languages or estimate rates. With about a dozen independent cells per
  sitting, the chance of telling a 10% hit rate from a 20% one is about one in ten per sitting; zero hits in 24
  trials is consistent with a true rate of up to about 12%. Do not read counts as percentages.
- Mail is tagged only when it is sent from the guide's primary button with the subject unedited. The Contact
  page, the footer address, the plain address in the call-to-action band and phone calls are not tagged.

## Before day 0 (the entry gate)

The pilot clock does not start until the pages that are already live are indexed. If they are not, the problem
is site-level discovery and no result below means anything.

1. Google Search Console and Bing Webmaster Tools verified for `vynatix.com` (Google Domain property: DNS TXT or
   CNAME. Bing: CNAME to verify.bing.com, an XML file, a meta tag, or import from Search Console; a DNS TXT
   record is unconfirmed for Bing). The Google HTML-file method does not work with `tools/verify/publish.js`.
2. `sitemap.xml` submitted in both tools.
3. URL Inspection shows the pages published on 2026-10-18 as indexed, with impressions: the English controls
   (`android-automotive-development.html`, `ai-engineering.html`,
   `android-automotive-consultancies-gothenburg.html`) and the four Swedish guides.
4. Read the English controls' Search Console impressions at their day 30 (2026-11-17) and **write the floors
   below before day 0.**

| Floor | Value (owner sets before day 0) |
|---|---|
| Per-page impressions that count as "above the floor" at day 90 | |
| Site-level impressions below which the result is "inconclusive" | |
| Cost cap in hours for phases 1 to 3, including this log (hitting it means freeze) | |

## Controls

- Same-language control: the three English pages above (published 2026-10-18). Compare per page, and note the
  page's age at each sitting.
- Same-format control: the four Swedish guides. Not comparable on impressions (Swedish queries, different
  internal links, a call to action that goes to `contact.html`).
- `choose-a-software-consultancy.html` is the twin of a Swedish control, so an engine may cite the Swedish page
  for an English prompt. Record that as its own category.
- Do not edit or retag the control pages during the run. Run the controls at every sitting.

## Protocol (the owner runs it; fix the prompts in writing before day 0)

Sittings on each pilot post's own day 0, 7, 30 and 90 (day 0 = the day it is live). Fix one tester locale and
write it here: ______.

Surfaces: ChatGPT search, Perplexity, Claude with web search, Bing Copilot (once Bing is verified), and Google
AI Overviews and AI Mode (the largest AI surface; otherwise visible only inside web impressions). The mapping
from robots.txt agents (OAI-SearchBot, Claude-SearchBot, PerplexityBot) to these surfaces is an assumption:
Claude search is reported to use Brave's index and ChatGPT search partly Bing, so access for the named bots is
necessary, not shown to be sufficient.

Prompts per post: P1 the H2 question verbatim; P2 a natural paraphrase. Run each twice per sitting. Day 0 is a
competitor baseline (who is cited today for these prompts), not proof that the page was not cited.

- **Citation**: a vynatix.com URL in the sources the engine shows. **Hit**: that URL is the pilot post.
  **Site hit**: any other vynatix.com page. **Mention**: Vynatix named without a link, recorded separately and
  never counted as a citation.
- Bing's AI Performance report (public preview announced 10 February 2026 on the Bing Webmaster blog) counts
  citations across Microsoft Copilot, AI summaries in Bing and unnamed "select partner integrations"; the
  grounding queries are a sample and it is not a complete log. Record it as "Bing AI citations (sampled)", not
  as Copilot citations.

| Date | Page | Surface and mode | Prompt | Run | Cited (y/n) | vynatix.com URL cited | Competing domains | Screenshot |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

Tagged mail and tool data, counts only:

| Date | Page | Tagged mail received | Of which genuine (owner's call) | Search Console impressions | Bing impressions | Bing AI citations (sampled) |
|---|---|---|---|---|---|---|
| | | | | | | |

## Outcomes at each pilot post's own day 90

- **Continue**: any one of an existence proof (a pilot URL cited), a genuine tagged enquiry, or per-page
  impressions above the floor. Write one more post and re-measure at its own day 90. At most two continue
  cycles before the owner re-decides.
- **Inconclusive**: the entry gate failed (pilot URLs not indexed after 30 days) or site-level impressions are
  below the floor. Extend once by 60 days and fix discovery first.
- **Freeze**: indexed, above the floor, and no citation and no genuine enquiry. No third post and no generator.
  Everything already published stays live, including the Blog page and its nav link, because URLs cannot be
  redirected. A freeze is not a withdrawal.
- The cost cap is a hard stop: hitting it means freeze.

If analytics are switched on during the pilot, re-baseline: the comparison is no longer like for like.
