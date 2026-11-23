---
title: Read usage from the terminal
description: Print the usage report, export every turn for a spreadsheet or an AI session, and read your burst in progress.
sidebar:
  order: 2
---

`menkar usage` reads the same history as the [Usage window](/menkar/usage/window/), prints it and
exits. It opens no window and needs no display.

## Print a report

```sh
menkar usage                                    # the last 7 days
menkar usage --period today                     # today, 7d, 30d or all
menkar usage --month 2026-10                    # a calendar month
menkar usage --from 2026-11-01 --to 2026-11-03  # both days included
menkar usage --period today --by hour           # one report per hour, day or month
menkar usage --json                             # JSON instead of text
```

A cost with `~` is an estimate at list prices, not a bill; a `+` means a model had no known price.

## Export every turn

`menkar usage export` writes one row per turn: its session and project, when it opened, its working
and waiting time, and its tokens and cost by model. No prompt or answer text, and no path, is in a
row.

```sh
menkar usage export --month 2026-10                  # JSON lines, one per turn
menkar usage export --period 30d --format csv        # CSV, for a spreadsheet
menkar usage export --project "Atlas app" --output turns.jsonl
```

Hand the export to a Claude Code session to analyse, for example: *"Run
`menkar usage export --month 2026-10` and tell me the cost per model for each project."*

`--rows activity` exports your own moments instead (messages, prompts answered, away and back), and
`--rows tasks` each change of a task's state. Neither holds any text.

`--rows panes` exports one row per 15 minutes: how many sessions were blocked, working, idle and
done, at most at once and for how long, over every project. A window Menkar was not running in has
its counts empty, never zero.

## Build your own break reminder

Menkar never tells you to take a break. For a program of your own that does, run:

```sh
menkar usage now --json
```

It prints one JSON object: whether you are in a burst of activity and since when, whether you are
away, your last action and today's active time. Run it about once a minute.

It also prints how many sessions are blocked and how many are working right now, `null` while
Menkar is not running.
