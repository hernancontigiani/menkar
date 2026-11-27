// Work without a task or without steps is reminded, never refused (decision 1.217): each side of
// the hand-over is told until it is fixed.

// The facts' line for an assignee whose current task has no steps.
export const noStepsLine = (task: number): string =>
  `Your task ${task} has no steps yet: split it with task_steps and report each advance.`

// The facts without that line. Its leaving is not told: the session left it by setting the steps,
// and a post would open a turn for nothing. The next change of its facts carries it away.
export const withoutNoSteps = (facts: string): string =>
  facts
    .split('\n')
    .filter((line) => !/^Your task \d+ has no steps yet: /.test(line))
    .join('\n')

export interface SentDeps {
  readonly hasOpenTask: (sessionId: string) => boolean
  readonly running: (sessionId: string) => boolean
  readonly name: (sessionId: string) => string
}

// The sessions the orchestrator sent work to that still have no open task, each a line, and which
// of them to keep remembering: one given a task, or no longer running, is forgotten.
export function sentWithoutTask(
  sent: Iterable<string>,
  deps: SentDeps,
): { readonly keep: readonly string[]; readonly lines: readonly string[] } {
  const keep = [...sent].filter((id) => deps.running(id) && !deps.hasOpenTask(id))
  return {
    keep,
    lines: keep.map(
      (id) =>
        `You sent work to ${deps.name(id)}, which has no open task: give it one with task_add.`,
    ),
  }
}
