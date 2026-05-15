---
# Vynatix website copy.
# Edit any value below, commit, and the deployed site updates.
#
# Notes for editors:
#  - Wrap a word in *asterisks* to italicise it (e.g. *Volvo* renders as the
#    serif italic accent used in headlines).
#  - For headlines that need a hard line break, use the | block scalar form
#    and start a new line — see hero.headline below.
#  - If a value genuinely needs to contain an asterisk that is NOT emphasis,
#    quote and escape it: e.g. "5\\*6".
#  - This file is fetched at page load. Serving via file:// will not work;
#    use `python3 -m http.server` for local preview.

meta:
  title: "Vynatix — A premium Nordic IT consultancy"
  description: "Vynatix is a Nordic IT consultancy. Engineers who write the case studies about the engineering. AI, cybersecurity, cloud — for Volvo, regulated industries and serious operators."

hero:
  eyebrow: "A premium Nordic IT consultancy"
  established: "Est. 2023"
  headline: |
    The consultancy *Volvo*
    would hire twice.
  lede: "We rebuilt the truck radio in sixteen weeks. Three engineers, four months, one production media player. We are engineers who write the case studies about the engineering."
  ctaPrimary:
    label: "Book a call"
    href: "#contact"
  ctaSecondary:
    label: "See the work"
    href: "#work"
  photoCaption:
    kicker: "Documentary photograph"
    subject: "Subject in working environment"
    indexLabel: "1 / 4"
    location: "Gothenburg, 2025"

marquee:
  - "Volvo Trucks"
  - "Volvo Cars"
  - "A Nordic bank"
  - "Sandvik"
  - "Skanska"
  - "Ericsson"
  - "AstraZeneca"
  - "A Swedish ministry"

services:
  eyebrow: "Services"
  headline: |
    Three practices.
    One bench of senior engineers.
  lead: "We do three things very well. Anything else, we say no to — politely, and with a referral."
  practices:
    - num: "01"
      title: "AI engineering"
      body: "We build production systems on foundation models, not demos. Retrieval, evaluation, deployment, observability. We say what the system can and cannot do."
      bullets:
        - "Retrieval-augmented generation"
        - "Evaluation pipelines"
        - "On-prem & sovereign cloud"
        - "Production observability"
    - num: "02"
      title: "Cybersecurity"
      body: "Threat modelling, penetration testing, incident response. Our security work passes audit because it was built to pass audit, not to look like it."
      bullets:
        - "Threat modelling"
        - "Penetration testing"
        - "Incident response"
        - "NIS2 & ISO 27001"
    - num: "03"
      title: "Cloud platforms"
      body: "GCP, AWS, on-prem hybrids for regulated industries. Build pipelines that stay green. Infrastructure that costs what it should cost."
      bullets:
        - "Platform engineering"
        - "Kubernetes & GitOps"
        - "FinOps & cost control"
        - "Migration from legacy"

work:
  eyebrow: "Recent work"
  headline: |
    Three engagements.
    Three real numbers.
  lead: "Selected from twenty-four projects shipped since 2024. The rest are under non-disclosure."
  seeAllLabel: "See all work"
  seeAllHref: "#work"
  cases:
    - cover: "case-cover-1"
      client: "Volvo Trucks"
      year: "2024"
      title: "A radio rebuilt in sixteen weeks."
      metric: "700,000 trucks"
      href: "#work"
    - cover: "case-cover-2"
      client: "Nordic bank"
      year: "2024"
      title: "Threat-modelling 47 findings, prioritised in nine."
      metric: "47 → 9 critical"
      href: "#work"
    - cover: "case-cover-3"
      client: "Volvo Cars"
      year: "2025"
      title: "Build pipeline cut from 47 to 6 minutes."
      metric: "−87% build time"
      href: "#work"
    - cover: "case-cover-4"
      client: "Regulator"
      year: "2025"
      title: "A closed-domain assistant that refuses to guess."
      metric: "0 hallucinations"
      href: "#work"

about:
  eyebrow: "About Vynatix"
  headline: "Engineers who write the case studies about the engineering."
  paragraphs:
    - "Vynatix is a division of Ultra Group, founded 2023 in Gothenburg. We staff teams with senior engineers — never more than fifteen at one time — and we write the work down so the next team can read it."
    - "We started Vynatix because most consultancies sell hours, and the hours sold rarely match the hours that move a project forward. Our engagements are scoped against an outcome — a deployed system, an audit passed, a build that stays green — and priced as fixed work, not as a body count."
    - "We are based on Magasinsgatan in Gothenburg, and a second desk in Stockholm where two of the security team work. We meet clients in person for the first conversation. The rest happens in writing."
  aboutLinkLabel: "About"
  aboutLinkHref: "#about"
  pullquote: "We staff against an outcome, write it down, and ship it. Then we write the case study."
  statKicker: "Est. 2023"
  statValue: "15"
  statLabel: "senior engineers, never more than that at one time"

numbers:
  eyebrow: "Since 2023"
  headline: "Numbers that withstand a second look."
  kpis:
    - value: "24"
      label: "Engagements shipped to production"
    - value: "15"
      label: "Senior engineers, never more than that at one time"
    - value: "4"
      label: "Audits passed without remediation"
    - value: "0"
      label: "Engagements abandoned mid-flight"
      accent: true

contact:
  eyebrow: "Considered work"
  headline: "Considered work, *on a clear timeline.*"
  lede: "One conversation, one written scope, one fixed price. We respond to inbound within one working day."
  cta:
    label: "Book a call"
    href: "#contact"
  email: "projects@vynatix.com"
  # Kept as an explicit field so editors can change the link target
  # independently if they ever need to (e.g. for a different mailbox).
  emailHref: "mailto:projects@vynatix.com"
  phone: "+46 31 123 45 67"

footer:
  tagline: "A premium Nordic IT consultancy. Engineers who write the case studies about the engineering."
  addressLines:
    - "Magasinsgatan 14, 411 18 Gothenburg"
    - "Birger Jarlsgatan 41A, 111 45 Stockholm"
    - "Org. nr 559412-2024 · A division of Ultra Group"
  columns:
    - heading: "Services"
      links:
        - { label: "AI engineering",      href: "#services" }
        - { label: "Cybersecurity",       href: "#services" }
        - { label: "Cloud platforms",     href: "#services" }
        - { label: "Custom software",     href: "#services" }
        - { label: "Mobile & automotive", href: "#services" }
        - { label: "Modernisation",       href: "#services" }
    - heading: "Company"
      links:
        - { label: "About",   href: "#about"   }
        - { label: "Work",    href: "#work"    }
        - { label: "Careers", href: "#about"   }
        - { label: "Contact", href: "#contact" }
    - heading: "Legal"
      links:
        - { label: "Privacy",     href: "#legal" }
        - { label: "Terms",       href: "#legal" }
        - { label: "WCAG 2.2 AA", href: "#legal" }
  copyright: "© 2026 Vynatix AB"
  domain: "vynatix.com"
---
