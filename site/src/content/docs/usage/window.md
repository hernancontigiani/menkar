---
title: See time, tokens and cost
description: Read how long your sessions worked, what they used and cost, and how you spent your own time.
sidebar:
  order: 1
---

Click :ui[header.usage] in the header. The Usage window opens on the project the window shows; click
:ui[usage.allProjects] at the foot of its left bar to see every project. Its figures cover every
agent's sessions; [Use Claude Code, Codex, Cursor or OpenCode](/menkar/start/agents/) says what
each agent reports.

## See what each session used

:ui[usage.section.spend] lists each project and its sessions for Today, 7 days, 30 days or a month.

![](shot:usage-spend)

| Column | What it counts |
|---|---|
| :ui[usage.exec] | The time the agent worked on your requests |
| :ui[usage.blocked] | The time it waited at a permission prompt for you |
| :ui[usage.tokens] | Input, output and cache tokens, each counted once |
| :ui[usage.cost] | What those tokens cost at the models' list prices |

A cost with `~` is an estimate at list prices, not a bill. A `+` means a model had no known price.
:ui[usage.byDay] shows the same figures as a bar per day.

The history keeps every turn, also after Claude Code deletes old transcripts.

## See your own time

:ui[usage.section.time] shows a day by the hour, or a week: when you were at work with the
sessions, the messages you sent and the prompts you answered. Actions less than 10 minutes apart
make one burst, and the time inside bursts is your active time. Time you marked as away counts
nothing.

![](shot:usage-your-time)

Menkar records these moments without any text: no message, no answer, no title.

## See how long tasks take

:ui[usage.section.tasks] shows, for projects in [the orchestration mode](/menkar/orchestration/),
how long tasks spent queued, in progress, waiting and in To review, and on whom they waited.

## Split each project by stage

To see each project split into plan, design, build, test, deploy and maintain, open
:ui[header.settings] › :ui[settings.section.usage] and turn on :ui[classifier.switch]. It is off
until you turn it on.

Each prompt you type from then on is sent to Claude Haiku with your own Claude Code login, with
your previous prompt and the files and commands the agent used, and it counts against
your plan. :ui[classifier.earlierButton] classifies the turns from before you turned it on, from a
date you choose, after showing how many turns it will send and an estimate of what they use.
