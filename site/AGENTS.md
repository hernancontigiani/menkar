# The site — tone guide and working rules

Rules for every page under `site/src/content/docs/` and every string in `e2e/captures/strings/`.
**An editorial comment on a page changes this file in the same turn**, written as a rule, never as
the story of the case that produced it. A comment that narrows an existing rule rewrites that rule,
rather than appending an exception to it.

## Who reads it, and which app
- Two readers: someone deciding whether to adopt Menkar, and someone using it.
- The site describes the current release only, and nothing before it.
- Only the roadmap page names what is not built, and only what `plans/00-STATUS.md` records as
  decided, with no dates and no plan numbers.

## What a line must earn
- A line earns its place only if the reader can do something differently with it.
- Most lines carry no reason. A why that explains how the app works goes: the reader asked what to
  do. A why stays only where its absence costs the reader something expensive or hard to reverse,
  and then in the rule's own sentence ("Close the tab first, so the session stops").
- Second person, imperative, in the prose as in the step titles ("Open the Board", not "The Board
  can be opened").
- No anecdote, no scaffolding: a page never talks about itself ("In this page we will…").
- Nothing twice: what a table says is not repeated in prose, and what another page explains is
  linked, not restated.
- A limitation the reader cannot act on is left out. One they must know before an expensive or
  hard-to-reverse choice goes in, with its consequence ("Deleting a transcript cannot be undone").

## Headings and structure
- A page or section is named for the reader's goal ("Follow the work", not "The Work view").
- A step's title is an imperative verb plus the object it acts on ("Mark an orchestrator").
- No pronouns and no numbers in headings. Point at another section by its name, never its number.
- A link to another page or section is checked by the build, because a renamed heading breaks it
  silently.
- Steps go in numbered lists; reference data (keys, settings, commands) in tables.

## Words
- One name per thing, in each language: the table below. A word in its last column is never used
  for that thing. A part of the product the table does not name is added to it before a page
  names it.

| Thing | English | Spanish | Not used | Key |
|---|---|---|---|---|
| A coding agent's conversation Menkar runs | session | sesión | chat, conversation, instance, agent / chat, conversación, instancia, agente | `menu.newSession` |
| The program a session runs (Claude Code, Cursor…) | agent | agente | model, bot, CLI / modelo, bot | `terminal.restoreUnsupported` |
| Sessions grouped under one name | project | proyecto | workspace, repository, folder / espacio de trabajo, repositorio, carpeta | `window.newProjectHeading` |
| A strip entry holding one or two sessions | tab | pestaña | window, view / ventana, vista | `tab.close` |
| One half of a split tab | pane | panel | split, frame / división, marco | `shortcut.paneLeft` |
| The project setting that turns on the team | the orchestration mode | el modo de orquestación | team mode, orchestration on its own / modo equipo, orquestación a secas | `orch.switchTooltip` |
| The session the human talks to | orchestrator | orquestador | manager, lead, coordinator / gestor, líder, coordinador | `orch.orchestrator` |
| A session started for one task | worker | worker | executor, sub-agent, child / trabajador, ejecutor, subagente | `orch.workersCap` |
| A session under the orchestrator with a role | expert | experto | specialist / especialista | `orch.workersCapHint` |
| A session with a role outside the team | consultant | consultor | advisor / asesor | `orch.consultants` |
| A session's short label | role | rol | title, tag / título, etiqueta | `orch.roleLabel` |
| What a role loads | skill | skill | plugin, command / habilidad, plugin, comando | `orch.roleSkills` |
| A piece of work handed to a session | task | tarea | job, ticket, issue, to-do / trabajo, ticket, incidencia | `work.doneTask` |
| What waits on the human's answer (the sidebar's section and the Board's column) | item; the section is "Awaiting you" | pendiente; la sección es "Pendientes tuyos" | topic, question, issue / tema, ítem, asunto | `topics.noticeTitle`, `orch.topics` |
| A task's mark of first place | the ★ | la ★ | priority, urgent / prioridad, urgente | `work.star` |
| A task's state before it closes | To review | Para revisar | in review, pending review / en revisión, pendiente | `board.toReview` |
| Every topic and task of a project on one screen | the Board | el Tablero | kanban, dashboard / kanban, panel | `board.button` |
| A worker's tab not drawn in the strip | in the background | en segundo plano | hidden, minimized / oculto, minimizado | `toast.background` |
| The one tab a background worker is shown in | the peek tab | la pestaña de vistazo | preview tab, temporary tab / pestaña de vista previa, pestaña temporal | — |
| Stopping a worker until its task can go on | park, parked | aparcar, aparcado | pause, suspend, archive / pausar, suspender, archivar, estacionar | `orch.parked` |
| A session the human took from the orchestrator | with you | con vos | taken over, manual / tomada, manual | `orch.withYouBadge` |
| The human's presence when not at the desk | away | ausente | idle, offline, AFK / inactivo, desconectado | `presence.away` |

## Commands and labels
- A command is complete and copyable, in a code block; a step that shows it does not also
  explain it word by word.
- A label of the app is written `:ui[key]`, never typed by hand, so it matches the app in each
  language. An unknown key fails the build.

## Screenshots
- Every image is a capture from the registry (`e2e/captures/registry.ts`), placed with
  `![](shot:<slug>)`; no image is added by hand.
- Every capture has its alt text, a short description of what it shows, in
  `e2e/captures/strings/<locale>.ts`, translated with the page. A capture without it fails the
  build.
- What a capture shows is a claim: invented names only (projects, sessions, folders, people,
  domains such as `example.com`), nothing that reads as a real customer, person or repository.
- A capture is shown where it proves the sentence beside it, not as decoration.

## Both languages
- English is the source; every page has its Spanish twin at the same path under `es/`, with the
  same sections in the same order and the same capture slugs, each resolved to the image taken in
  that language. A change to one is made to both in the same change.
- The build fails when a page has no twin under `es/`, or when the twins differ in the number and
  levels of their headings or in their capture slugs.
- Spanish speaks as the app does: voseo ("Elegí", "podés"), the same terms as the app's catalog.

## Privacy
- The site tracks nobody: no analytics, no remote script, font, image or frame. Links out are
  plain links. `npm run site:check` fails a build that loads anything from another origin.
