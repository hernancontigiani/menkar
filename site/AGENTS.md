# The site — tone guide and working rules

Rules for every page under `site/src/content/docs/` and every string in `e2e/captures/strings/`.
**An editorial comment on a page changes this file in the same turn**, with the case that produced
it, so the next page does not repeat the mistake.

## What a line must earn
- A line earns its place only if the reader can do something differently with it.
- A rule keeps its reason in the same sentence ("Close the tab first, so the session stops").
- No anecdote, no scaffolding: a page never talks about itself ("In this page we will…").
- Nothing twice: what a table says is not repeated in prose, and what another page explains is
  linked, not restated.
- A limitation the reader cannot act on is left out. One they must know before an expensive or
  hard-to-reverse choice goes in, with its consequence ("Deleting a transcript cannot be undone").

## Headings and structure
- A page or section is named for the reader's goal ("Follow the work", not "The Work view").
- A step's title is an imperative verb plus the object it acts on ("Mark an orchestrator").
- No pronouns and no numbers in headings. Point at another section by its name, never its number.
- Steps go in numbered lists; reference data (keys, settings, commands) in tables.

## Commands and labels
- A command is complete and copyable, in a code block; a step that shows it does not also
  explain it word by word.
- A label of the app is written `:ui[key]`, never typed by hand, so it matches the app in each
  language.

## Screenshots
- Every image is a capture from the registry (`e2e/captures/registry.ts`), placed with
  `![](shot:<slug>)`; no image is added by hand.
- What a capture shows is a claim: invented names only (projects, sessions, folders, people,
  domains such as `example.com`), nothing that reads as a real customer, person or repository.
- A capture is shown where it proves the sentence beside it, not as decoration.

## Both languages
- English is the source; every page has its Spanish twin at the same path under `es/`, with the
  same sections in the same order and the same captures. A change to one is made to both in the
  same change.
- Spanish speaks as the app does: voseo ("Elegí", "podés"), the same terms as the app's catalog.

## What is not built yet
- Only the roadmap page names what is not built, and only what `plans/00-STATUS.md` records as
  decided, with no dates and no plan numbers. Every other page describes the released app.

## Privacy
- The site tracks nobody: no analytics, no remote script, font, image or frame. Links out are
  plain links. `npm run site:check` fails a build that loads anything from another origin.
