# Plan 35: notifications, read-only tabs and handing sessions to the orchestrator

> **Status:** written 2026-11-12 by `set` with the human, ready to execute.
> **Design:** decisions 1.99–1.104 (`plans/00-STATUS.md` §1), discussed as topics 3–9 in Menkar's
> own Topics section; the survey `plans/ideas/research/reported-states.md`.
> **Exit, when executed:**
> - `docs/orchestration.md`: notifications in the mode, the topic notifications and the dock
>   count, the topic order, read-only tabs and their banners, handing a session to the
>   orchestrator, `adopt_session`.
> - `docs/agent-state.md`: who notifies (mute, the mode's rule), with history for what leaves.
> - `docs/sessions.md`: `muted` in `state.json`, followed on a new id.
> - `docs/session-control.md`: `adopt_session` (nine tools), the two new wake texts.
> - `plugin/skills/orchestrator/SKILL.md`: a child's permission prompt becomes a blocking topic;
>   `adopt_session` only on the human's explicit request; the take/hand-back messages.
> - `plans/00-STATUS.md`: rows 1.99–1.104 point to their docs (set does it at closing).
> **Amends:** 1.77's topic order (1.100), already recorded.

## 1. Goal

In the orchestration mode the human hears only what is theirs: the orchestrator and the topics.
Sessions under the orchestrator are muted and read only until the human takes control of one.
Any session can be muted by hand, in any mode.

### What already exists (verified 2026-11-12)

- **Notifications:** `plan(state, windowFocused, settings)` (`src/core/agentstate/notify.ts:42`)
  decides sound and toast/desktop; `notify(pane, state)` (`src/main/agentstate.ts:81`) runs it when
  `notifies(previous, next, seen)` holds (agentstate.ts:140). Desktop notifications live in a
  `NotificationTray` (`src/core/agentstate/tray.ts`), whose `size` is the dock count.
- **Per-session flags in `state.json`:** `remote_control` (`src/core/remote.ts`), a sorted id list,
  followed to a new id by `followRemoteControl` — the precedent for `muted`.
- **The mode's data:** `orchestration` on `Project` (`src/core/projects/orchestration.ts`), parents
  (`src/core/projects/parents.ts`, `setParent` at 24), topics (`src/core/orchestration/topics.ts`:
  `shownTopics` at 137 holds the order, `status` open/discussing/closed).
- **The first-time card:** `firstTimeCard` (`src/renderer/orchestration.ts:104`).
- **Terminal input:** `term.onData → window.menkar.panes.input(pane.id, data)`
  (`src/renderer/terminals.ts:300`), handled in main (`src/main/workspace.ts`, the `panes:input`
  path, which also feeds drawers).
- **Wakes:** `wakeSession` / `postToSession` (`src/main/workspace.ts`, around 1282).
- **MCP tools:** eight, in `TOOL_NAMES` (`src/core/control/files.ts:12`).

## 2. The design

### 2.1 Who notifies (1.99, 1.104)

A pure function in core, `notifiesFor(session, project, muted)`:
- **muted** (in `state.json`'s `muted`) → no notification, in any mode;
- mode off → as today;
- mode on: the orchestrator → yes; a session marked "with you" → yes; a session **under the
  orchestrator** (its parent is the orchestrator) → no; any other (loose) session → yes.

`notify` in main asks it first; nothing else about the notification changes. Dots, the sidebar's
blocked counts and the dropdown's badge still count every session: only alerts are muted.

**Mute:** "Mute" / "Unmute" in every row menu, in any mode; a muted-speaker icon in the row after
the name (like the phone icon, 9×13, the text color). Stored as `muted` (sorted ids) in
`state.json`, followed to a new id on `/clear`, resume, renew and a reused name, as
`remote_control` is.

### 2.2 Topic notifications (1.103) and order (1.100)

- **Order** (`shownTopics`): ★ sessions' topics first, then blocking ones, then by number.
- **A new topic** notifies as a blocked session does, through the same settings (sound, toast or
  desktop notice): title "Topic N", body its title. A click shows the orchestrator's tab and
  unfolds the topic. Muting the orchestrator does not mute topics: Menkar raises them, not it.
- **A topic becoming blocking** (`topic_update` with `blocking: true` on a non-blocking one)
  notifies again; any other change does not.
- **While any topic of the project is "discussing"**, a new topic's notification has no sound; the
  notice and the count still happen.
- **Seen:** a topic gets `seen: true` (in `topics.json`) when the human unfolds it or double-clicks
  it. **The dock count** is the tray's notifications plus the open topics not seen, of every
  project.

### 2.3 Read-only tabs and the banners (1.101)

While the mode is on, the tab of a session **under the orchestrator** and **not "with you"** is
read only:
- **Main drops its input** (the `panes:input` path checks it), so a paste or any key never
  reaches the agent; the renderer also ignores keys there, without blocking the app's shortcuts.
  Scrolling, selecting and copying work.
- **A yellow warning banner** across the top of the tab: "This session reports to the
  orchestrator." with a button "Take control". Taking control marks it "with you" (1.86's mark),
  makes the tab writable, and posts to the orchestrator "[Menkar] The human took control of ‹name›".
- **With "with you"**, the banner is **blue** (info): "This session is with you." with "Hand back
  to the orchestrator", which clears the mark, makes it read only again, and posts
  "[Menkar] The human handed ‹name› back".
- **At a permission prompt** (shown state `blocked`), the tab is writable while it stays blocked;
  the banner stays yellow and says "Waiting for your permission".
- Loose sessions and the orchestrator have no banner and stay writable. Mode off: no banner,
  nothing read only.

### 2.4 Handing a session to the orchestrator (1.102)

- **Row menu**, in the mode, for any session but the orchestrator: "Hand to the orchestrator"
  (sets its parent to the orchestrator) or, for one under it, "Take back from the orchestrator"
  (removes the parent).
- **First-time card:** under "Who orchestrates?", a list "Sessions the orchestrator manages" with a
  checkbox per listed session, all checked; "Start" sets their parent to the chosen orchestrator
  (a new orchestrator: once it exists).
- **`adopt_session { name }`**, a ninth MCP tool: the orchestrator makes a session of its project
  its child. Refused to anyone but the orchestrator and with the mode off. The skill says it is
  called only when the human asks for it explicitly in the chat.
- Nothing restarts and nothing is typed: only who is woken changes.

### 2.5 Rejected, and why

- **Reported states** (`set_waiting`): in the mode a worker waits only on the orchestrator, and the
  human's questions go as topics; deferred in `docs/NOT_BUILT_YET.md` (topic 6).
- **Muting loose sessions in the mode** (1.99's first form): nothing would ever wake anyone for
  them (1.104).
- **Muting topics with the orchestrator:** the human would lose what waits on them.
- **Read only by hiding the terminal:** the human must still watch the session work.

### 2.6 Product decisions and the tests that hold them

| Decision | Test (before the code) | The case |
|---|---|---|
| Who notifies (1.99, 1.104) | `tests/core/orchestration/notifies.test.ts` | mode on, O orchestrator, W child, L loose, Y child "with you": O yes, W no, L yes, Y yes; L muted: no; mode off: W yes; O muted: no |
| Mute follows a new id | `tests/core/mute.test.ts` | X muted; X → Y: Y muted, X not |
| Topic order (1.100) | `tests/core/orchestration/topics.test.ts` | 1 (A), 2 (★B), 3 (A, blocking), 4 (A) → [2, 3, 1, 4] |
| Which topic events notify (1.103) | same, a pure `topicNotice(before, after, discussing)` | new → sound; new while one is discussing → no sound, notice; text change → none; becomes blocking → notice |
| Unseen count | same | 3 open, 1 seen, 1 closed unseen → 2 |
| Read only (1.101) | `tests/core/orchestration/readonly.test.ts`, pure `readOnly(session, project, shown)` | child not with-you → true; with-you → false; blocked → false; loose → false; orchestrator → false; mode off → false |
| `adopt_session` | `tests/core/control/server.test.ts` (nine names) and a pure check | orchestrator adopts W → W's parent O; a worker calling → refused; mode off → refused |
| Input dropped in main | `e2e/orchestration.spec.ts` | type in a read-only tab → the stand-in claude receives nothing; after Take control → it does |

## 3. Out of scope

- Reported states (`set_waiting`); notifications for other agents than Claude (2.21).
- Notification settings per project or per topic beyond Mute.
- A digest or a "do not disturb" period.

## 4. Do not touch

- Notifications with the mode off for unmuted sessions: today's behaviour and its specs unchanged.
- The orchestrator's own tab: always writable.
- `topics.json` entries written by plan 34: a missing `seen` reads as false.
- The human's running Menkar, `~/.config/menkar/`, `~/.claude`.

## 5. Execution blocks

Each block ends with `npm run ci` green; UI blocks run their spec and `npm run ui-check` whole at
the end, screenshots to `/tmp/menkar-shots/`, copies with the worker's name in `$MENKAR_FILES`.

### Block 1 — mute, and who notifies
- [ ] Tests first: `notifies.test.ts`, `mute.test.ts` (rows 1–2); see them fail.
- [ ] `src/core/mute.ts` (list, set, follow) and `notifiesFor` in `src/core/orchestration/`; main's
  `notify` asks it; mute followed wherever `followRemoteControl` is called.
- [ ] Row menu "Mute"/"Unmute" in any mode; the muted-speaker icon in the row; strings in en/es.
- [ ] Spec: mute a session → its row shows the icon; a blocked state raises no toast.
  Screenshot `‹name›-mute.png`.
- **Verify:** `npm run ci`; the spec.

### Block 2 — topic order, notifications, unseen count
- [ ] Tests first (rows 3–5).
- [ ] `shownTopics` order; `seen` in the store (lenient); `topicNotice`; main raises the notice on
  `topic_add` / `topic_update`; the click shows the orchestrator's tab with the topic unfolded;
  unfold or double-click marks it seen; the dock count adds the unseen topics.
- [ ] Spec: add a topic → a toast "Topic N"; with one discussing → still a toast, no sound call
  (assert through the sound path's log or a test hook main already has, not the speaker).
- **Verify:** `npm run ci`; the spec.

### Block 3 — read-only tabs and banners
- [ ] Test first (row 6); `readOnly` in core.
- [ ] Main drops input for a read-only pane; the renderer ignores keys there without blocking
  app shortcuts.
- [ ] The yellow and blue banners, Take control / Hand back (actions setting "with you"), the two
  [Menkar] messages to the orchestrator through `wakeSession`'s path; writable while blocked.
- [ ] Spec (row 8) and screenshots `‹name›-banner-yellow.png`, `‹name›-banner-blue.png`.
- **Verify:** `npm run ci`; the spec; `e2e/terminal.spec.ts` and `e2e/paste.spec.ts` unchanged.

### Block 4 — handing sessions to the orchestrator
- [ ] Test first (row 7).
- [ ] Row menu items; the card's checkbox list; `adopt_session` (`TOOL_NAMES`, `TOOLS`,
  `handleControl`) with its refusals.
- [ ] Spec: hand a loose session over from the menu → it nests under the orchestrator and its tab
  turns read only; the card with one box unchecked leaves that session loose. Screenshot
  `‹name›-card-managed.png`.
- **Verify:** `npm run ci`; the spec.

### Block 5 — skills and documents
- [ ] `plugin/skills/orchestrator/SKILL.md`: a child's permission-prompt wake becomes a blocking
  topic; `adopt_session` only on the human's explicit request; what the take/hand-back messages
  mean (stop / resume giving it work). Under 200 lines.
- [ ] The exit's documents, with history for every line that leaves.
- **Verify:** `npm run ci` (plugin parity included); `npm run ui-check` whole.

## 6. Execution log

(Written by the session that executes it.)
