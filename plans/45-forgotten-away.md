# 45 — A forgotten away is asked about: the orchestrator's prompt carries it, the amber strip asks

> **Status:** written, 2026-11-19, by `menkar-t124` (task 124). Not executed. Five details are
> the human's (D1–D5, §2.4); the blocks are written with the recommended option of each, and
> say what changes under another answer.
>
> **Comes from:** decision 1.188 (the human, 2026-11-19, topic 68, option C), on top of 1.167
> (away ends only by the human) and 1.181 (`human_away`). The mock-up of (B)'s strip, drawn in the
> real app under Playwright and `xvfb-run` in a temporary home, both themes, is in the project's
> files folder as `menkar-t124-*.png` (§2.3).
>
> **Exit when executed:**
> - How the standing away line reaches the orchestrator, the inbox file's new key, and what was
>   rejected → `docs/session-control.md`, "The inbox" (block 1); one sentence in
>   `docs/context.md`, the `UserPromptSubmit` hook: it gives a text when the file holds only the
>   away line (block 1). The hook's recorded sentence "with the inbox's text" changes; its old
>   text goes verbatim to `docs/history/context.md` in the same change.
> - The asking strip, when it asks, several windows, and the rejected forms → `docs/orchestration.md`,
>   "The human's presence" and "Rejected" (block 2).
> - What the user sees → `plugin/guide/orchestration-mode.md`, "Away or here" (block 2); what the
>   orchestrator does → `plugin/skills/orchestrator/SKILL.md`, "When you are woken" (block 1).
> - `plans/00-STATUS.md`: 1.188's "Where it lives" becomes `docs/orchestration.md` ·
>   `docs/session-control.md`, and D1–D5's answers as their own rows or in 1.188's text (`set`,
>   at closing).
> - The rest (block order, the mock-up script) → `git log`.
>
> **Replaces or modifies:** no plan and no decision. It adds to `docs/` without removing a rule,
> but for the hook sentence above.

---

## 1. Goal, and what already exists

**Goal.** While the human is marked away, (A) every prompt the orchestrator gets carries that they
are away, so the orchestrator asks whether they are back and calls `human_back` only on an
explicit yes; (B) the first key, click or scroll in a main window turns the amber strip of every
window into a question, "You're using Menkar — are you back?", with "I'm back". Nothing clears
away by itself.

**What exists, verified in the tree on 2026-11-19:**

- **Presence** is pure in `src/core/presence.ts`: `Presence { away, since }`, `HERE`, `setAway`
  (going away twice keeps the first `since`), `presenceAsked` (away only while some project has
  the mode on), `presencePost` ("The human is away: …" / "The human is back"), `backTool`,
  `awayTool`, `topicNoticeNow`. Tests: `tests/core/presence.test.ts`.
- **Main holds it in memory** (`src/main/workspace.ts:1689`, `let presence = HERE`). Every change
  goes through `askPresence(away, clearedBy?)` (`workspace.ts:1699`): it posts `presencePost`'s
  text to each mode-on project's inbox under the key `presence` (or retracts it from the
  orchestrator that changed it), wakes orchestrators without an inbox, journals `away`/`back`
  (`recordPresence`), and `push()`es the window state. The window state carries
  `presence: PresenceView` (`src/shared/workspace.ts:149`, built at `workspace.ts:642`).
- **The inbox entry `presence` is delivered once**: an entry is dropped once the orchestrator's
  transcript shows a `hook_additional_context` naming its `seq` (`Inboxes.refresh` →
  `confirm`, `src/main/inbox.ts`). So today the orchestrator hears "The human is away" with one
  prompt, not with every prompt — the gap (A) closes.
- **The inbox file** is written by Claude's kit (`src/main/agents/claude/inbox.ts`,
  `PromptInbox.publish(pane, sessionId, dropped, entries)`, declared in `src/main/agents/types.ts:33`),
  `{ session_id, dropped, entries }`, and **removed when no entry is pending**. The hook's command
  runs the statusline only `if [ -f <inbox>/<pane>.json ]` (`docs/context.md`, the
  `UserPromptSubmit` hook), and `runPromptSubmit` (`src/core/context/statusline.ts:364`) returns
  nothing when `entries` is empty. `inboxText` (`src/core/orchestration/inbox-text.ts`) builds the
  text, first line "Menkar's inbox (events a–b): …", within `INBOX_TEXT_MAX_BYTES` (1,500);
  `deliveredThrough` (`src/core/agents/claude/inbox.ts`) reads the range back with
  `/Menkar's inbox \(events (\d+)–(\d+)\)/`. `inbox-text.ts` imports nothing (the statusline runs
  it under plain Node). Tests: `tests/core/context/statusline.test.ts:362–`,
  `tests/core/orchestration/inbox.test.ts`, `tests/core/agents/claude/inbox.test.ts`.
- **The presence marks** (`src/renderer/presence.ts`): `keydown`, `pointerdown`, `wheel` on
  `window`, capture and passive; only while `document.hasFocus()`; at most one a minute per window
  (`markDue`, `src/core/activity/marks.ts`, `MARK_INTERVAL_MS` 60 s; a clock set back is due at
  once); each sends `activity:present` (empty). Main's handler (`src/main/index.ts:83`) calls
  `recordPresent` (`src/main/activity.ts:111`), which applies the same minute across windows and
  journals `present` with the window's shown project. **Marks are journaled while away too**
  (`docs/usage.md:287`); the reading counts nothing inside an away period. The Usage and Settings
  windows send none.
- **The strip** (`src/renderer/app.ts:395–420`): `awayBanner()` — moon icon, `.bar-text` "Away
  since HH:MM" (`presence.awaySince`), button `#away-back` "I'm back" (`setPresence` false);
  `renderAway` shows it and `#away-side` (its sidebar half) while away, and draws the chip
  `#presence-chip` ("● Away · I'm back"). Styles `src/renderer/style.css:2166–2260`. Strings
  `presence.*` in `src/core/i18n/en.ts:288` and `es.ts:293`. The e2e of presence:
  `e2e/session-control.spec.ts:747–` (Ctrl+B a, banner in every window, the inbox lines,
  `menkar-t48-away-banner-*.png`).
- **The orchestrator's skill** (`plugin/skills/orchestrator/SKILL.md:139`) says, on "The human is
  away": events to topics or the status file; `human_away`/`human_back` only on the human's
  explicit word. It does **not** say to ask whether they are back. The user's guide
  (`plugin/guide/orchestration-mode.md`, "Away or here") already promises "the orchestrator asks
  whether you are back" when the human writes to it while away — a promise nothing carries today
  but the single inbox line.

## 2. The design

### 2.1 (A) A standing away line in every orchestrator prompt

**The away state is not an inbox entry; it is a standing line of the inbox file.** Main writes the
file while away even with no entry, with a new key `away_since` (milliseconds, from the clock), and
the hook puts one line before the inbox's events on every prompt. It is never "delivered": it
leaves the file only when the human is back.

- **Main.** `Inboxes` gets `setAway(since: number | null)`: held once for every project (presence
  is the app's), and every project's file is kicked. `refresh`'s `held` key includes it, so a
  change rewrites the file; with `since` set and no entry, the file is written, not removed.
  `PromptInbox.publish` gains a last parameter `awaySince: number | null`; Claude's kit writes
  `away_since` when it is a number and removes the file only when there is neither an entry nor
  away. `askPresence` calls `inboxes.setAway(presence.away ? presence.since : null)` after every
  change, **for the orchestrator that changed it too** (unlike the `presence` entry it retracts):
  after `human_away` from the phone, that orchestrator's next prompt is the human's on the phone,
  which is the case to ask about. `moved` and the mark moving to another session keep it by
  construction (it is not an entry).
- **The hook.** `runPromptSubmit` reads `away_since`: a finite number, or absent; any other value
  is treated as absent. It returns a text when there are entries **or** `away_since`; with
  neither, nothing, as today.
- **The text.** `inboxText(entries, dropped, maxBytes, awaySince?)` puts first, on its own line:
  `The human is marked away since HH:MM. If this prompt is the human's own, first ask whether they
  are back; call human_back only if they say yes.` (English, for an agent; local time from the
  hook's process, `HH:MM`, as the strip shows it). Then the inbox's lines as today, when there are
  any. With no entry, the text is the away line alone — **with no "Menkar's inbox (events …)"
  line**, so `deliveredThrough` confirms nothing from it (the regex finds no range). The budget
  counts the away line: it is never cut, the events are.
- **The skill.** "When you are woken" gets one bullet: "**"The human is marked away since …"**
  heads your prompt while they are away. When the prompt is theirs (typed, from Remote Control or
  in Menkar — not a `[Menkar]` wake, not another session's message), first ask whether they are
  back, once per away (the time names it): on an explicit yes call `human_back`; on anything else
  go on as away and do not ask again for that time." And the existing bullet keeps "only on the
  human's explicit word".
- **Several orchestrators** (several mode-on projects): each file carries the line; each asks its
  own human prompt. One `human_back` clears it for all (`askPresence` is global).
- **An orchestrator whose kit has no inbox** (`MainAgentKit.inbox` null; not Claude) is out of
  scope: it is woken once with the away post, as today (§3).

### 2.2 (B) Menkar asks: the strip turns into a question

- **State.** `Presence` gains `asking: boolean` (false in `HERE`; `setAway(…, true)` starts it
  false; back is `HERE`). A pure `noticed(presence, at): Presence` in `src/core/presence.ts` returns
  `{ …presence, asking: true }` when away, not yet asking, and `at - since >= ASK_AFTER_MS`
  (60 s, D3) — **or `at < since`** (a clock set back asks at once, as `markDue` does); otherwise
  the same object. It never touches `away` or `since`: **nothing clears away by itself**.
- **How main learns of activity while away.** The same `activity:present` message the marks
  already send. Main's handler (`src/main/index.ts:83`) also calls a new `noticeActivity()` in
  `src/main/workspace.ts`, **before** `recordPresent`'s own minute across windows, so a mark that
  is not journaled still counts: `presence = noticed(presence, now())`, and `push()` only when it
  changed. The journal is unchanged: marks are journaled while away as today, and the reading
  counts nothing inside away. The renderer is unchanged: its per-window minute is the only delay
  (the first event after a quiet minute is sent at once; the key or click that set away was sent
  *before* away began, since the listener runs in the capture phase).
- **Why a grace of a minute** (D3): the human who presses `Ctrl+B a` and finishes a scroll or a
  click on their way out would otherwise get the question at once. The renderer's own minute
  already covers the window where away was set; `ASK_AFTER_MS` makes the rule explicit and covers
  `human_away` from the phone and another window.
- **What the strip shows.** While `asking`, `renderAway` draws the asking form: the text
  `presence.asking` ("You're using Menkar — are you back?") in bold, then " · Away since HH:MM",
  dimmer; the strip and its sidebar half a stronger amber (38 % instead of 24 %); "I'm back"
  filled amber. Same height, same place, same button and action (`setPresence` false). The chip
  stays "● Away · I'm back" (D4). `role="status"` stays; the text change is announced once.
- **Several windows.** The state is main's and global, so the question shows in **every** main
  window at once, whichever window the activity came from; "I'm back" in any clears every one
  (as today). Activity in the Usage or Settings window asks nothing (they send no marks).
- **Until when.** The question stays until the human is back (any of the five ways: the strip, the
  chip, `Ctrl+B a`, `human_back`) — D1: no "Not yet". A new away starts not asking. A quit forgets
  it with the rest of presence.
- **(B) does not reach the orchestrator.** It is the human's own question; the standing line (A)
  says nothing of activity. (Rejected below.)

### 2.3 The mock-up

`$MENKAR_FILES/menkar-t124-*.png`, each in `-dark` and `-light`, 1280×720, the real app (built
`out/` of 2026-11-19 13:20) in a temporary home, a project in the orchestration mode, away set with
`Ctrl+B a`; the asking forms are drawn over today's DOM by the script, nothing built:

| File | Shows |
|---|---|
| `menkar-t124-1-today-*` | The strip as it is: "Away since 14:16", "I'm back"; the chip "● Away · I'm back" |
| `menkar-t124-2-asking-*` | **Recommended**: "**You're using Menkar — are you back?** · Away since 14:16", stronger amber, "I'm back" filled; chip unchanged |
| `menkar-t124-2b-asking-not-yet-*` | D1's option B: the same with "Not yet" before "I'm back" |
| `menkar-t124-3-asking-chip-asks-*` | D4's option B: the asking strip with the chip reading "● Away — back? · I'm back" |

### 2.4 Decisions for the human

- **D1 — "Not yet".** (A) **No "Not yet"; the question stays until back** — *recommended*: the strip
  is thin and blocks nothing; a "Not yet" that hides it "until the next activity" would come back
  with the very next key, since the human is using Menkar, so it would need a timer (a third state
  to test) to mean anything. (B) "Not yet" returns to the plain strip until activity after a quiet
  spell of 10 min (the bursts' gap). Under (B), block 2 adds `declined: number | null` and the
  rule in `noticed`.
- **D2 — the wording.** (A) **"You're using Menkar — are you back?"**, then "· Away since HH:MM" —
  *recommended*, the decision's own words, with the time kept so the human sees how long. (B)
  "Away since HH:MM — still away? You're using Menkar." Spanish for (A): "Estás usando Menkar —
  ¿ya volviste?" (my draft; the catalog's tone).
- **D3 — the grace.** (A) **One minute after away is set, activity asks nothing** — *recommended*
  (above). (B) No grace: the first mark asks, even a click on the way out. (C) Longer (5 min).
- **D4 — the chip.** (A) **Unchanged** — *recommended*: the strip already asks; two questions in
  one window is noise. (B) "● Away — back? · I'm back" while asking.
- **D5 — when the orchestrator asks** (skill wording, (A)). (A) **Only on the human's own prompt,
  once per away** — *recommended*: a `[Menkar]` wake or a peer's message is not the human; asking
  in reply to those writes questions nobody reads and repeats on every wake. (B) On every prompt,
  as the line says it is away. Under (B) the away line's sentence and the skill drop "If this
  prompt is the human's own" and "once".

### 2.5 Rejected, with why

- **Clearing away on activity, or after a while of it** — 1.188 and 1.167: away ends only by the
  human.
- **Back-dating "I'm back" to the first activity** (so the minutes between count): a back the human
  did not give, written into the usage journal; and with (B) the question comes within seconds, so
  little is lost.
- **Re-posting the `presence` entry on every prompt** instead of a standing line: the entry is
  dropped once its `seq` is confirmed; re-adding it would take a new `seq` per prompt and make the
  inbox's range carry a state that is not an event.
- **Telling the orchestrator that Menkar saw activity** ("the human is using Menkar since 13:02"):
  not in 1.188; the orchestrator would act on a guess the human did not confirm. Deferred, no
  trigger yet — not written to `NOT_BUILT_YET.md` unless the human asks.
- **The renderer deciding to ask on its own** (each window flipping its strip): two windows would
  disagree, and a window opened later would not ask.
- **A modal or a toast**: the strip is where away already lives (1.167); a modal would take a key
  meant for a terminal.

## 3. Out of scope

- Orchestrators without an inbox (an agent other than Claude as orchestrator): they get the away
  post once, as today.
- Remote Control's own screen: (A) covers it through the orchestrator.
- The usage reading, `menkar usage now`, the journal: unchanged.
- Any change to how away is set, to its post texts, or to `topicNoticeNow`.

## 4. Do not touch

- `deliveredThrough`'s regex and what it confirms; the `presence` entry's add/retract in
  `askPresence`.
- The renderer's mark listeners (`src/renderer/presence.ts`) and `markDue`: they observe only, and
  the minute stays.
- `recordPresent`'s journaling and its cross-window minute.
- The versions strip under the away one (`versionsBanner`, `app.ts:430–`), which shares
  `.away-banner`'s shape: the asking style goes on a modifier class of the away strip only.
- `tests/core/context/statusline.test.ts`'s existing cases: extended, not rewritten.

## 5. Execution blocks

Two blocks, **one worker each, in order, not in parallel**: both touch `src/main/workspace.ts`
(block 1 one call in `askPresence`, block 2 a new `noticeActivity` beside it). Block 1 first; or one
worker for both, in order.

### Block 1 — (A) the standing away line

Files: `src/core/orchestration/inbox-text.ts`, `src/core/context/statusline.ts` (`runPromptSubmit`),
`src/main/agents/types.ts` (`PromptInbox.publish`), `src/main/agents/claude/inbox.ts`,
`src/main/inbox.ts`, `src/main/workspace.ts` (`askPresence` only),
`plugin/skills/orchestrator/SKILL.md`, `docs/session-control.md`, `docs/context.md`,
`docs/history/context.md`; tests `tests/core/orchestration/inbox-text.test.ts` (new, or the
existing file that tests `inboxText`), `tests/core/context/statusline.test.ts`,
`tests/main/inbox.test.ts` or wherever `Inboxes` is tested (find it; if none, the e2e below).

- [ ] Tests first, each seen failing:
  - `inboxText([], 0, 1500, since)` is the away line alone, with `HH:MM` of `since`, and contains no
    "Menkar's inbox (events"; with two entries, the away line first, then the inbox's first line
    with "(events 1–2)"; with entries over the budget, the away line is whole and "N more: call
    inbox." counts the rest. (1.188: every prompt while away carries it.)
  - `runPromptSubmit` (real process, as the existing cases): a file `{ session_id, dropped: 0,
    entries: [], away_since }` gives `additionalContext` starting "The human is marked away since";
    the same with `away_since: "x"` or absent and no entry gives nothing; entries without
    `away_since` give today's text unchanged.
  - Claude's kit `publish`: no entry and `awaySince` null removes the file; no entry and a number
    writes it with `away_since`; the reader's keys stay inside the writer's (extend the existing
    parity, or add one: `session_id`, `dropped`, `entries`, `away_since`).
  - `Inboxes`: `setAway(t)` with an empty inbox publishes with `t`; a delivery confirmed after it
    keeps `t` in the file; `setAway(null)` removes the file when no entry is left; the mark moving
    (`moved`) keeps it.
  - `deliveredThrough` over a transcript whose record holds only the away line confirms 0.
- [ ] Build it as §2.1. `askPresence` calls `inboxes.setAway(…)` on every change, the orchestrator
  that changed it included.
- [ ] Skill bullet as §2.1 (D5 (A)). Docs per the exit; the hook sentence's old text to
  `docs/history/context.md` verbatim.
- [ ] e2e: extend `e2e/session-control.spec.ts`'s presence test: after `Ctrl+B a`, the inbox file
  holds `away_since`; after the orchestrator's fake prompt consumes the `presence` entry, the file
  still exists with `away_since` and no entry; after "I'm back", it holds no `away_since`.
- [ ] Verify: `npm run ci` green; `npm run ui-check` on `e2e/session-control.spec.ts`.

### Block 2 — (B) the strip asks

Files: `src/core/presence.ts`, `src/main/workspace.ts` (`noticeActivity`, beside `askPresence`),
`src/main/index.ts:83` (the handler), `src/renderer/app.ts` (`awayBanner`/`renderAway`),
`src/renderer/style.css` (the away part), `src/core/i18n/en.ts`, `src/core/i18n/es.ts`,
`docs/orchestration.md`, `plugin/guide/orchestration-mode.md`; tests `tests/core/presence.test.ts`,
`e2e/session-control.spec.ts`.

- [ ] Tests first, each seen failing (`tests/core/presence.test.ts`):
  - `noticed`: away since 1,000, at 1,000 + 59,999 → not asking (same object); at 1,000 + 60,000 →
    asking, `away` and `since` unchanged (1.188: never cleared by itself); here → unchanged;
    already asking → same object; a clock set back (at 500) → asking.
  - `setAway(asking, true, …)` keeps `since` and `asking` (going away twice); `setAway(asking,
    false, …)` is `HERE` with `asking` false; a new away starts not asking.
  - `presenceView` carries `asking`.
- [ ] Build it as §2.2, with the recommended D1–D4. `.away-banner.asking` for the style; the
  versions strip untouched. Strings `presence.asking` in both catalogs.
- [ ] e2e (`e2e/session-control.spec.ts`, beside the presence test; screenshots to
  `$MENKAR_FILES` as `menkar-<session>-away-asking-{dark,light}.png`): set away; a key in the
  window within the minute → the strip still "Away since"; advance main's and the renderer's
  clock past a minute (`app.evaluate` and `page.evaluate` patching `Date.now`, which
  `src/core/clock.ts` reads — check it holds before relying on it), press a key → the asking strip
  in **both** windows (open a second one as the existing test does), the chip unchanged,
  `presence.away` still true; "I'm back" in the second window → both strips gone; away again → not
  asking.
- [ ] Docs per the exit: `docs/orchestration.md` (the asking strip, its minute, several windows,
  nothing clears away, the rejected items of §2.5 that concern the strip) and the guide's "Away or
  here" (one sentence: Menkar asks when you use it while away).
- [ ] Verify: `npm run ci` green; `npm run ui-check` on `e2e/session-control.spec.ts`; the
  screenshots match `menkar-t124-2-asking-*`.

## 6. Execution log

(Written by the session that executes it.)
