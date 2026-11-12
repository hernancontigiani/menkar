# b1: how Menkar's skills can reach the sessions it starts (decision 1.71)

Measured 2026-11-12 with the real `claude` 2.1.322 under node-pty, no code in the tree.

## Setup

- **Isolation:**
  - each run had a throwaway HOME (onboarding done, a fake key approved, the folder trusted);
  - `XDG_RUNTIME_DIR` was left out of the env;
  - a stand-in API on 127.0.0.1 recorded every request, so I could see what the model receives;
  - the human's `~/.claude` and sockets were never touched.
- **Cleanup:** every process was stopped by PID, and the stale `/tmp/cc-socks/<pid>.sock` files of
  my runs were removed by name.
- **Files:** scripts, screens and request logs are in
  `/tmp/claude-1000/-home-hernan-git-menkar/7f7bb609-981d-42b4-ba52-25dee4a1f713/scratchpad/sk/`
  (`drive.mjs`, `fakeapi.mjs`, `mcp.mjs`, `r1`–`r8/`).
- **Control run (r2, no flags)** wrote the same files as every other run:
  - `~/.claude/settings.json` (`skipDangerousModePermissionPrompt`), `history.jsonl`, `sessions/`
    and `projects/`;
  - a clone of the official marketplace under `~/.claude/plugins/marketplaces/` (727 files, despite
    `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`);
  - `~/.config/mimeapps.list` and a `claude-code-url-handler.desktop`.

  Claude writes these on any first start, so none of them comes from the probes below.

## 1. `--plugin-dir <dir>`: works, and is the cleanest way

The plugin was `.claude-plugin/plugin.json` `{"name":"menkar",...}` plus
`skills/menkar-worker/SKILL.md` (with `name` and `description` frontmatter).

- **It loads under `menkar:<skill name>`**:
  - `menkar:menkar-worker` from frontmatter `name: menkar-worker`;
  - `menkar:orchestrator` from a folder `skills/orchestrator/` with no `name`.

  So the decided names `menkar-orchestrator` etc. would show as `menkar:menkar-orchestrator`;
  naming the folders `orchestrator`, `worker` and `distill` gives `/menkar:orchestrator`.
- **The model sees it.** The first request's system reminder lists it under "The following skills
  are available for use with the Skill tool:", as
  `- menkar:menkar-worker: <description>`.
- **The model can load it.** A `Skill` tool call with `menkar:menkar-worker` (driven by the stand-in
  API) showed `Skill(menkar:menkar-worker) ⎿ Successfully loaded skill`. The tool result carried
  `Base directory for this skill: <dir>` followed by the body.
- **The user can run it by `/name`.**
  - `/menkar:menkar-worker please` sends `<command-name>/menkar:menkar-worker</command-name>`, the
    base directory and the body, then `ARGUMENTS: please`.
  - Typing the unprefixed `/menkar-worker hi` and pressing Enter accepted the autocomplete, which
    became `/menkar:menkar-worker hi`.
  - The autocomplete shows `(menkar) <description>`.
- **`/skills`** lists `✔ menkar:menkar-worker   locked by plugin · plugin · ~60 tok`, with "Plugin
  skills are managed via /plugin". **`/plugin`** opens the Discover tab; opening it writes
  `plugins/plugin-catalog-cache.json` and `plugin-directory-cache-v2.json`, which `--plugin-dir`
  alone does not.
- **No trust prompt or warning** appeared, in a folder that was already trusted.
- **Writes under `~/.claude`: none in `~/.claude/`.** Claude did write two counters into
  **`~/.claude.json`**:
  - `pluginUsage["menkar@inline"]` (`usageCount`, `lastUsedAt`, `lastUsedNumStartups`), on every
    start with the plugin;
  - `skillUsage["menkar:menkar-worker"]` (`usageCount`, `lastUsedAt`), once the skill was used.

  Claude itself writes these into its own file, Menkar doesn't, but the human should know they
  appear.
- **Two `--plugin-dir`s** both named `menkar` merged into one `menkar:` namespace without error
  (r6).

## 2. Without a plugin

- **`--add-dir <D>` loads `<D>/.claude/skills/`** (r4):
  - `/skills` shows `✔ menkar-orchestrator   project`, unprefixed;
  - the model's listing has `- menkar-orchestrator: <description>`.

  Menkar already passes `--add-dir <project files folder>`, so skills placed there would load. But
  that folder is the user's, and `--add-dir` also opens the directory to the file tools, a side
  effect the plugin doesn't have.
- **`permissions.additionalDirectories` in `--settings` does not load skills**: r5's `/skills` says
  "No skills found".
- **No settings key or env var for an extra skills folder exists in 2.1.322.**
  - The only per-skill settings key is `skillOverrides`
    (`on` / `name-only` / `user-invocable-only` / `off`).
  - The skill-related env vars are `CLAUDE_CODE_DISABLE_CLAUDE_CODE_SKILL`,
    `CLAUDE_CODE_SKILL_ATTRIBUTION`, `CLAUDE_CODE_INVOKED_SKILLS`, `..._SYNC_SKILLS_...` and
    `..._DESKTOP_SKILL_SWITCHES`; none adds a folder.
  - The binary names one source "plugins auto-loaded from .claude/skills/" (`skills-dir`), and
    says "skills and custom commands from user, project, and --add-dir sources".
- **`--bare`** keeps `--plugin-dir` and `--add-dir`, according to `claude --help`; not run.

## 3. MCP prompts

A 40-line stdio server, passed with `--mcp-config` and named `menkar`, offered one prompt `worker`
with an argument `task`.

- **They show as slash commands.** The autocomplete shows `/menkar:worker (MCP)  <description>
  (arguments: task)`.
  - **The working name is `/mcp__menkar__worker`.** Typing `/menkar:worker two words` gave
    "Unknown command: /menkar:worker" (r8).
  - `/mcp__menkar__worker build it` called `prompts/get` with `{"task":"build"}`: **arguments are
    split by spaces**, so the first word went to `task` and "it" was dropped.
  - The returned message reached the model after a `<command-name>/mcp__menkar__worker</command-name>`
    block.
- **They can carry a skill's text, but only the user can call them.**
  - The prompt's description was in **no** request to the model, so it cannot be triggered from
    its description.
  - The `Skill` tool refuses `menkar:worker` ("Unknown skill").
- **MCP-served skills exist in the binary but are off in 2.1.322.**
  - The code has a client for skills served as MCP resources whose URI ends in `/SKILL.md`
    (`io.modelcontextprotocol/skills`; limits 512 files, 16 MiB, SKILL.md ≤ 1 MB), with a
    "person answers the ask before an MCP skill loads" gate.
  - Its enable function is compiled as `return!1`.
  - My server declared the extension and listed `skill://menkar-worker/SKILL.md`. Claude called
    `resources/list` and never `resources/read`, and `/skills` said "No skills found".
- **`/mcp`** shows `⚠ menkar   no tools · connected`.
- **Writes:** an MCP log under `~/.cache/claude-cli-nodejs/<project>/mcp-logs-menkar/`, and nothing
  under `~/.claude/`.

## 4. Codex and Gemini (docs only; nothing installed or run)

- **Codex**:
  - It reads the same SKILL.md format from `.agents/skills` in every directory from the cwd up to
    the repo root, plus `$HOME/.agents/skills` and `/etc/codex/skills`.
  - Invocation is implicit from the description, or explicit with `$name` or `/skills`.
  - Plugins can bundle skills, but come only from a marketplace (a repo marketplace is possible).
    The official page names **no flag or env var** that loads a plugin or skills folder for one
    session.
  - `-c key=value` overrides config per run, but whether it works for `plugins.*` is not
    documented.
  - The only per-project route is a `.agents/skills` folder in the project, which is a write into
    the user's repository.
- **Gemini CLI**:
  - It reads `.gemini/skills` or `.agents/skills` in the workspace, `~/.gemini/skills` or
    `~/.agents/skills`, and skills inside extensions.
  - Extensions load from `~/.gemini/extensions` (`install` or `link`, both persistent). No
    per-session flag is documented.
  - Activation goes through an `activate_skill` tool with a consent prompt, and users have no
    direct `/name`.
  - geminicli.com says Gemini CLI was replaced by Antigravity CLI on 2026-06-18 for unpaid-tier
    and Google One users.
- **Shared route:** a project-level `.agents/skills/<name>/SKILL.md` is read by both Codex and
  Gemini. Claude Code reads `.claude/skills` instead.

Sources: https://learn.chatgpt.com/docs/build-skills (redirected from
developers.openai.com/codex/skills), https://learn.chatgpt.com/docs/plugins.md,
https://geminicli.com/docs/cli/skills/, https://geminicli.com/docs/extensions/reference/.

## Not measured

- A folder that is not yet trusted, with `--plugin-dir` (all runs used a trusted one).
- Choosing the MCP prompt from the autocomplete with Tab or Enter, rather than typing its name.
- Cursor (`cursor-agent` is not installed).
- macOS and Windows.
- How a real model picks the skill from its description: the stand-in API only shows that the
  description is in the listing.
