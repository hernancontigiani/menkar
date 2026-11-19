# The public documentation site: what we learned before designing it

Collected by `set` on 2026-11-19, for whoever designs the site (topic 71). Not a plan.

## What the human asked (2026-11-19)

- Client-facing documentation, **English by default and fully translated to Spanish**.
- **Many screenshots**, so it sells by the eye, with the **orchestration mode as the headline**: it
  is what sets Menkar apart.
- Per page, a menu like docs.langchain.com's "Copy page" (the human's reference:
  https://docs.langchain.com/langsmith/python/managed-deep-agents-overview): copy the page as
  Markdown for an agent, view as Markdown, llms.txt, Open in Claude / ChatGPT. The MCP entries of
  that menu do not apply to Menkar.
- **A tone guide** for client-facing text, taking ccai's as a reference.
- Where it is built and hosted: topic 71 (Astro Starlight on GitHub Pages, Mintlify, MkDocs
  Material). Plan 28 already chose GitHub Pages for "a small site".

## From ccai's `documentation` session (2026-11-19)

Their pipeline renders PDF and Word, not a site: **none of their builder transfers**. Two things
do: the rules about what a document may say, and the discipline around screenshots.

**Tone guide.** It is ccai's `publications/CLAUDE.md`, and it loads whenever a file under its folder
is touched. Rules that generalize:
- A step's title is an imperative verb plus the object it acts on; a section is named for its goal.
  No pronouns and no step numbers in headings.
- A line earns its place only if the reader can do something differently with it.
- A rule keeps its reason in the same sentence.
- No anecdote, no scaffolding, no duplication: a document never talks about itself, and what is in
  a table is not repeated in prose.
- Point at another section by its name, never its number.
- Reference data goes in tables, steps in numbered lists.
- A command is complete and copyable, and a step that shows it does not also explain it.
- A limitation the reader cannot act on is left out; one they must decide before an expensive,
  hard-to-reverse choice goes in, with its consequence.
- **An editorial comment on a document updates the rules file in the same turn**, with the case that
  produced it.

ccai-specific, not to copy: their product names, the ban on em dashes, and "never mention what is
not built". Menkar is going public with a new main feature, so it likely needs a roadmap.

**Screenshots and seeds.**
- Each capture has a seeding script that puts the app into a known state first. The script takes a
  `--check` that always runs first: without it, a capture against an unseeded app writes empty
  screens and exits 0.
- After a capture run, open every image it wrote. Two images of the same byte size are usually the
  same screen: a step that failed to navigate photographs the previous screen again.
- **The locale translates the chrome, not the content.** Seeded names, titles and example prompts
  render in whatever language the seed wrote. So **the seed takes the locale as a parameter from
  its first version**, with its strings in the app's own catalogs, and the two locales' seeds stay
  **structurally identical**: the same rows, order and states. Otherwise the two trees become two
  documentations.
- Decide before the first page whether the Spanish tree gets its own captures. Menkar's UI is
  localized (en, es), so it can.
- **What a screenshot shows is a claim**: invented names and domains only, nothing that reads as a
  real customer or person.
- **One registry of what exists** (their builder's book list, printed by `--list`): no second list
  anywhere, because theirs drifted inside a skill.
- **A command is untested until it has run on a clean machine**; re-reading the code is not that
  test.

They offered to review our draft tone rules.

## Menkar's own constraints that apply

- `docs/` stays internal. The site is new and separate.
- The app makes no network connections and has no telemetry. Whether a docs site with third-party
  analytics fits that is a values question for the human.
- Screenshots already come from the real app under Playwright and `xvfb-run`, in a temporary home
  (`npm run ui-check`, the mock-up tasks). Seeds for them would be fixtures in that home.

## Mintlify against Astro Starlight, researched 2026-11-19 (sources in the research)

| | Mintlify | Starlight on GitHub Pages |
|---|---|---|
| Price | Free plan, 5 editors, custom domain. Pro is $450/mo; free Pro for non-commercial OSS, by application | $0 |
| Copy page, View as Markdown, Open in Claude/ChatGPT | Built in (`contextual.options`) | Small third-party plugins (starlight-page-actions, starlight-llm-actions), or our own component |
| llms.txt | Built in | `starlight-llms-txt`, by a Starlight core maintainer |
| Spanish | Language switcher, manual translations on every plan | First-class: a folder per locale, untranslated-page notice, Spanish UI strings |
| Search | Hosted (Trieve) | Pagefind, static, one index per language |
| Ask AI, analytics, preview deploys | Pro only | None by default |
| Tracking | Telemetry on unless turned off; every visit reaches Mintlify's servers | None |
| Exit | Export or self-hosting only on Enterprise; its own MDX components and `docs.json` | Plain static files on any host |
| Screenshots | Light/dark variants and zoom built in | A few lines of CSS for light/dark; `starlight-image-zoom` |

Mintlify's free plan was already reshaped once (relaunched 2026-09-28).

## ccai's Playwright capture scripts, as their `documentation` session read them (2026-11-19)

The scripts are ccai's `publications/tooling/capture-*.mjs`, documented in its `MAINTAINING.md`,
"Screenshots". What transfers to an Electron app launched by `_electron` in a temporary home:

- **Own the process and readiness.** Wait for the first window, then for an element that exists
  only once the app has loaded its state. Close the app in a `finally`; the temporary home
  guarantees a clean run. ccai cannot do this, so it refuses a stack it does not recognise:
  without that check, a run once photographed another product on the same port.
- **Navigation is per-screen imperative code, not a declarative list.** Two primitives:
  `goto(route, readyLocator)`, and `shot(name)` / `shotClip(name, clip)` (a region, for a strip of
  the window). The body runs go, wait for proof that the screen is real, shoot.
- **`CAPTURE_ONLY=prefix,…` filters what is written while still walking the whole flow**, because
  screens are stateful.
- **Guards:**
  - a fixed viewport, and `deviceScaleFactor: 2`;
  - one colour scheme by choice (ccai uses light only; a site can do both, at twice the captures
    and the reviews);
  - fonts from the app itself;
  - **no `networkidle`**: wait on a locator, then a short settle;
  - collect `pageerror` and report it at the end;
  - reduce each PNG to a 256-colour palette (about 40% of the size, nothing visible lost on a
    flat UI).
- **Volatile content is owned by the seed, not masked in CSS**: anything derived from the current
  time is a thing the seed controls. A frozen stand-in clock once made a card say "last heard 76m
  ago".
- **Name a capture by a stable slug of the screen, not by its reading order.** ccai's `NN-slug`
  couples renumbering a document to renaming files.
- **What they would change, in order:**
  1. Seed and capture in **one command**, with the check inside it.
  2. **Assert on what was written, not the exit code**: hash every image and report which changed
     since the last run, and which two are identical (a failed navigation photographs the previous
     screen again).
  3. Replace the fixed delays with one condition: no spinner or skeleton visible.
  4. Identify the app by something it stamps.
- **For Menkar: the app's own storage is the seed.** Write the state through the app (its IPC, its
  own writers), not by fabricating its files underneath it, or the seed becomes a second,
  undocumented copy of the app's formats that drifts.
