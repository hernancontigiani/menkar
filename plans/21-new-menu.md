# Plan 21: one "New ▾" menu, and the agent chosen in Add session

> **Status:** written 2026-11-09, waiting for `set`'s OK before any block runs (it deletes
> features). Executed by `b1`.
>
> **Exit, when executed:**
> - Decision 1.30 stays in `plans/00-STATUS.md` §1 (`set` records it).
> - `docs/spec/README.md`: the M table loses M8, M9 and M11, and M7 and M12 are rewritten. F16 and
>   F50 lose "continue last", "advanced new session" and "New chat". Each removed line goes verbatim
>   to `docs/history/spec/README.md` in the same change.
> - `docs/spec/chat.md` ("Starting a new chat (M11)"), `docs/sessions.md` (the advanced dialog
>   sentence, "Continue last" in the Remote Control bullet) and `docs/window.md` ("Continue last"
>   in "A new session joining its project") are trimmed. Each removed line goes to its history file.
> - `docs/window.md` gains a bullet on the header's "New ▾" and its four items.
> - The rest goes to `git log`.

## Goal

The header's New split button (an icon `+` plus a `▾` menu with one item per agent and per chat
variant) becomes **one text button "New ▾" / "Nuevo ▾"** with four items. Each item shows its
shortcut. The agent is chosen on Add session's New page.

## What exists (verified 2026-11-09)

- Header: `#new-session` (icon `tabNew`, opens Add session on New) and `#new-menu` (icon `down`,
  calls `plusMenu`) in `.split` with a `.sep` (`src/renderer/app.ts` ~142–156).
- `plusMenu` (`src/renderer/addsession.ts` ~565) lists, per installed agent:
  - New {agent} session…;
  - New {agent} session (advanced)… (`advancedNewSession`);
  - Continue last {agent} session… (action `continueLast`);
  - Open file…;
  - one New {agent} chat… per chat variant (action `newChat`);
  - New window.
- Shortcuts that already exist (`src/renderer/main.ts` 35–46): Ctrl+Shift+T (Add session → New),
  Ctrl+Shift+O (Open file), Ctrl+Shift+N (New window). Ctrl+` comes with plan 20 (b2, in progress).
- Add session → New has an Agent `<select>` only when more than one agent is installed
  (`addsession.ts` ~376). Claude's Remote Control switch shows only for Claude. Installed agents
  come from `WindowState.agents` (main checks `AGENT_COMMANDS` on the PATH).
- `MenuItem.shortcut` exists (1.20).

## The design

1. **Header.** Remove `#new-session` (the `+`) and the `.split` and `.sep` around it. `#new-menu`
   becomes a text button labeled `t('header.new')` ("New ▾" / "Nuevo ▾"). It uses Close all's
   resting look (fill, 1 px inset edge, 26 px), shared by one rule: `.header-text-button`, given
   to both. Its tooltip is "New session, terminal, file or window".
2. **The menu** (`newMenu`, replacing `plusMenu`), four items, each with `shortcut`:
   - New session (Ctrl+Shift+T): `openAddSession('new')`;
   - Terminal in this tab (Ctrl+`): the function plan 20's key calls (name agreed with b2; see
     below). Off (`disabled`, with a title saying why) when the selected tab cannot have a drawer:
     no tab, or a kind plan 20 excludes;
   - Open file… (Ctrl+Shift+O): `openFileDialog()`;
   - New window (Ctrl+Shift+N): `newWindow()`.

   Coordination: if plan 20 is not merged when block 2 runs, I ask b2 for the exported toggle's
   name and module. I don't build a second toggle.
3. **The agent on New.** A `.segmented` picker at the top of the New page, with one segment per
   supported agent (`claude`, `cursor`, from the same table main uses to detect them).
   - An agent that is not installed is `disabled`, with the title `t('add.agentMissing',
     { command })`, for example "cursor-agent is not installed".
   - Default: Claude Code if installed, else the first installed agent.
   - Choosing an agent keeps today's per-agent behaviour: the Remote Control switch shows for
     Claude only and is reset to off; the name stays required for Claude only.
   - It replaces the `<select>` row. The picker is shown even with one agent installed, so the
     human sees Cursor greyed out.
   - `openAddSession`'s `agent` option stays (Existing → New handoffs and tests use it).
4. **What becomes unreachable, and what happens to it.** Default: deleted, since nothing else
   reaches it.

   | Feature | Still reached by | Proposal |
   |---|---|---|
   | Advanced dialog (`advancedNewSession`, `MODELS`, `MODES`, `advanced.*` keys, `.advanced-form` CSS) | nothing | **delete** |
   | `openAddSession`'s `flags` option (model, mode, addDir), the `newSession` action's flags, `command.ts`'s `--model` / `--permission-mode` / `--add-dir` | only the advanced dialog | **delete**. `command.ts` keeps resume, fork and new |
   | `continueLast` action, `start: { kind: 'continue' }` in `command.ts`, `tab.tooltipContinue`, `menu.continueAgent` | nothing | **delete**. The "unknown id, newest session of the folder" join stays, because Cursor's new sessions use it |
   | `newChat` action, `chooseChatFolder`, `chat.newMode` / `chat.newSole` | nothing | **delete** |
   | Chat tabs, the permission card, `startChat`, MCP servers, Open in Ghostty | the session row's "Continue in chat" (M36), ⚙ → MCP servers, the row's Open in Ghostty | **keep** |
   | Chat restore on start | there is none: chat tabs are never saved (`TabView.chat`: "never saved") | nothing to do. Saved layouts cannot hold a chat tab, so no notice is needed |
   | `menu.newAgent`, `menu.advanced` keys | nothing | **delete** |
   | `pickFolder` action, `addTransientTab` | New's Browse, forks, replay | **keep** |

   The two remaining routes to a chat (Continue in chat, and what CHT tests use) are unchanged.

## Tests, written first and seen red

- **LOOK-68** (titlebar.spec):
  - the header has no `#new-session`;
  - `#new-menu` reads "New ▾" (en) and "Nuevo ▾" (es), with no svg;
  - its resting fill is ≥8 off the header, and its height equals Close all's;
  - it sits left of Close all and clears the title;
  - LOOK-60's no-overlap check stays green.
- **SES-71** (sessions-cases):
  - the menu has exactly four items, in order: New session, Terminal in this tab, Open file…, New
    window;
  - each shows its shortcut: Ctrl+Shift+T, Ctrl+`, Ctrl+Shift+O, Ctrl+Shift+N;
  - each does its job: Add session opens on New; the drawer toggles (after plan 20); the file
    chooser is asked; a second window opens;
  - no item contains "advanced", "Continue last" or "chat".
- **SES-72** (addsession.spec): the New page's agent picker.
  - With both agents installed (fake `claude` and `cursor-agent` on the PATH): two segments,
    Claude chosen; choosing Cursor hides the Remote Control switch; choosing Claude shows it again,
    off.
  - With only `claude`: Cursor is disabled, titled "cursor-agent is not installed", and Claude is
    chosen.
  - With only `cursor-agent`: Claude is disabled and Cursor is chosen. This replaces RC-4's "no
    Agent row".
- Existing tests that change (more lines for check-test-integrity; listed in the report):
  - TRM-17 and TRM-18 (the advanced dialog): **deleted**.
  - RC-11/12: the "Continue last carries none" half is deleted; the fork half stays.
  - SES case at sessions-cases ~345 (New Cursor session… from the menu): it now picks Cursor on
    New's picker.
  - RC-3 and RC-4: the select becomes the picker.
  - LOOK-1: `.split #new-session svg` and `.split .sep` give way to the text button.
  - LOOK-62: `#new-menu` stays an opener, so it keeps working.
  - chat.spec, 8 calls to `act({ type: 'newChat' … })`:
    - The tests about the chat tab itself (CHT-5/6/13/15/16/32/35, CHT-8/12/30, CHT-13 trusted,
      CHT-27/28, the chat look) get their chat through `continueInChat` on a fixture session.
      Their assertions stay.
    - The parts that assert New chat's own folder chooser (CHT-4's chat chooser half) are deleted.
      PRF-30's session chooser half stays.

## Out of scope

- The ⚙ menu, the session row menu and the tab menu.
- Chat tabs themselves, Continue in chat, MCP servers.
- Plan 20's drawer: this plan only calls it.

## Do not touch

- Ctrl+Shift+T, Ctrl+Shift+O and Ctrl+Shift+N keep their behaviour; only the menu shows them.
- Add session → Existing; New's folder, name and Remote Control switch.
- The "unknown id" join (Cursor needs it).

## Blocks

1. **Tests first.** Write LOOK-68, SES-71 (without the drawer item's action) and SES-72, and see
   them red on the current build.
2. **Header and menu.** Text button, `newMenu` with shortcuts, the `+` and `.split` removed, the
   shared header-text-button rule, i18n en/es. Ask b2 for the drawer toggle, or wire it if plan 20
   is in. Verify: LOOK-68, SES-71, LOOK-1, LOOK-60, LOOK-62, then `npm run ci`.
3. **The agent picker on New.** Replace the select. Add `add.agentMissing` and the supported-agent
   list for the renderer, which needs uninstalled agents too: `WindowState` gains `agentCommands`,
   or the table moves to `src/core`. Verify: SES-72, RC-3, RC-4, the SES case at ~345, then
   `npm run ci`.
4. **Deletions.** The advanced dialog, flags, continueLast, `kind: 'continue'`, newChat,
   `chooseChatFolder`, and their keys and CSS. Rewrite chat.spec's setup to `continueInChat`;
   delete TRM-17, TRM-18, the Continue last half of RC-11/12 and CHT-4's chat half. Verify:
   `npm run ci` (check-code-rules and i18n catch orphans) and a full ui-check.
5. **Docs.** The spec M table, F16 and F50, chat.md, sessions.md, window.md, each removed line
   verbatim to history. Verify: `npm run ci` (nothing-lost), full ui-check, screenshots
   `/tmp/menkar-shots/new-menu-*.png` (header and open menu, both styles and both schemes, plus the
   New page picker).

## Execution log

Executed by `b1` on 2026-11-09, all five blocks.

- **Tests first:** LOOK-68, SES-71 and SES-72 were red on the build before block 2 (`#new-session`
  present; 6 menu items; no picker).
- **Block 2:** `newMenuAt` lives in `app.ts`, beside `toggleDrawer`, not in `addsession.ts`;
  `plusMenu` is gone. "Terminal in this tab" calls plan 20's exported `toggleDrawer()` and is off on
  no tab or a replay, the same tabs `toggleDrawer` skips. New ▾ and Close all share
  `.content-header .header-text`. LOOK-66 compared Close all with `#new-session`; it now compares
  with `#toggle-sidebar`.
- **Block 3:** `AGENT_COMMANDS` moved from `src/core/sessions/installed.ts` (which imports `node:fs`)
  to a pure `src/core/agents.ts`, so the renderer reads the supported agents without a
  `WindowState` field. The picker shows on both New steps, folder and name.
- **Block 4:** `MODE_KEY` moved from `addsession.ts` to `sessionmenus.ts`, its only consumer.
  Deleted TRM-4, TRM-5 and TRM-6 (vitest: continue and the advanced flags), and TRM-7 lost its
  model and mode. The chat tests start their chats with `continueInChat`. The Cursor ones use a
  Cursor transcript fixture (`withCursorSession`), and CHT-8's argv check now also expects
  `--resume <id>`, since a continued chat resumes. Twenty orphaned i18n keys were removed from en
  and es.
- **Not anticipated:** a new window from a single-project fixture asks for a project name first,
  so SES-71 answers that dialog. One chat.spec run had a single `toHaveCount` failure that did not
  reproduce: the next run passed 9/9, then 27/27 with `--repeat-each 3`.
