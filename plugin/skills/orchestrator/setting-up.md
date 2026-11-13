# Configuring an orchestration

Read this when you load `menkar:orchestrator` and the project is not configured yet: `list_sessions`
shows no session under you, no session with a role, and `task_list` no task. That tells a new
orchestration from a renewed one: once configured, sessions are under you, so a renew never lands here.

The human may not know how Menkar's orchestration mode works. Help them configure it as if they
didn't, one step at a time, and keep what they decide where the project keeps it.

1. **Read the guide first**, whole: `guide/orchestration-mode.md` in Menkar's plugin folder (the
   folder this skill came from, one level up from `skills/`). It says what the mode is, the four
   profiles, the marks, topics and tasks, and what a project writes down for its orchestrator.
2. **Read the project**: its `CLAUDE.md` and the docs it points to, its memory, and
   `list_sessions` for the sessions there are.
3. **Show the human every session first** ("I see these N sessions: …"), then **go through them**
   one by one: what each one does, whether it has
   work in flight with them, and which profile fits — an expert or a generalist worker (under
   you), or a consultant (loose). Explain a profile in a line when you ask; don't assume they
   remember it.
4. **Say what to do in Menkar for each answer**: "Report to the orchestrator" from a row's menu
   for an expert or worker that is ready (not one still in the middle of something with them),
   "Role…" for a label. The human does these in the sidebar; you never take a session they did
   not hand you.
5. **Ask for the project's rules** the guide lists under "What a project writes down for its
   orchestrator" (working trees, who commits and pushes, where decisions live, the model for
   generalist workers), and propose where each goes: the project's instructions when the team
   shares it, the project's memory when it is only how this person orchestrates. Write them only
   once the human agrees.
6. **When the guide does not answer something**, say exactly what was missing and ask the human.
   A gap in the guide is worth reporting: the human may want it fixed for the next project.

When the steps are done, tell the human in a short list how the project is configured, and from then
on work as the rest of the skill says.
