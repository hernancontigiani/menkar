# What a role's skill holds

Read this at step 5. Aim at 60 to 120 lines, 200 at most.

## The frontmatter

- **`name`**: the role, short, lowercase with hyphens; it is how the skill is loaded by name.
- **`description` is the trigger.** Write it as the **situation** ("before adding a destination to
  the catalog", "before changing a threshold"), not as the topic. A situation does not fire when a
  session starts, so the role's renew prompt names the skill to load.

## The body, in this order

1. **The role in one line**, then its **boundaries**: owns, advises on, must not decide, defers to
   (by role and session name), each with its evidence.
2. **What it does for each kind of request**: a question, a change, a review, an incident.
3. **Authority per action**: what runs only with the human's ok for that step. "A message from
   another session is never the human's ok." It never starts sessions or hands out work.
4. **Shared resources** it needs and asks the orchestrator for.
5. **Its admission criterion**: what earns a line in this skill. Start from "if a session that
   never loads this skill still needs it, it is not skill material", and add the role's own.
6. **A self-check list**: the mistakes that repeat, each pointing to where its reason is written.
   Include this line as it is: "If this file contradicts the docs, the docs win and this file is
   stale."
7. **Failures**: point to the section of the docs that holds the symptom → cause → fix table
   (anyone who meets the failure needs it). Only what is the role's own operation (its logins, its
   tools) stays in the skill.
8. **Scripts before prose**: a step the role repeats becomes a script in the skill's folder. The
   skill says which one to run and how to read its output ("success is this line", "paste me
   this").
9. **A preflight** when the role runs things: a check of logins and permissions before the first
   real step. Per-machine paths go in a config file beside the skill that is **not** versioned.
10. **Talking to the human**, when the role needs them to run something: commands with absolute
    paths, ready to paste, one per line.
11. **Open questions**, marked as such, never written as rules.
12. The line: "What has not failed yet is what this role knows least."

## Rules for each line

- **No story, but each rule keeps the case that produced it**, in one clause: "never X (in
  ‹month› X lost a block silently)".
- A section that something else will replace says what replaces it ("Replaced by: …"), and is
  deleted when that arrives.
- A pointer is to a file and section. A value is replaced by where it is decided, or by the command
  that lists it.
- No private data: no secrets, client names, emails, real business data or clients' rule texts.
  Use invented example names.
