import { BURST_GAP_SECONDS } from './usage/bursts'

// The human's presence, away or here: one state for the whole app, held in memory only, so a
// quit forgets it and every start is "here". It concerns the orchestrators alone.

export interface Presence {
  readonly away: boolean
  // When the human went away; null while here.
  readonly since: number | null
  // Absent until Menkar is used while away. Asking: the strip asks whether the human is back.
  readonly asking?: boolean
  // The question was put away, by Not yet or by a quiet spell: it comes back only on activity
  // after a quiet spell.
  readonly resting?: boolean
  // The last activity seen while away, or the Not yet.
  readonly lastActive?: number
}

export const HERE: Presence = { away: false, since: null }

// What the windows show: the switch only while some project has the orchestration mode on.
export interface PresenceView {
  readonly away: boolean
  readonly since: number | null
  readonly asking: boolean
  readonly shown: boolean
}

export function presenceShown(modesOn: readonly boolean[]): boolean {
  return modesOn.some(Boolean)
}

export function presenceView(presence: Presence, modesOn: readonly boolean[]): PresenceView {
  const { away, since } = presence
  return { away, since, asking: presence.asking === true, shown: presenceShown(modesOn) }
}

// The sidebar's chip: while the mode is on somewhere, and while away even if it no longer is, so
// it can always be cleared.
export function chipShown(view: PresenceView): boolean {
  return view.shown || view.away
}

// Going away twice keeps the first time.
export function setAway(presence: Presence, away: boolean, at: number): Presence {
  if (away === presence.away) return presence
  return away ? { ...HERE, away: true, since: at } : HERE
}

// Activity on the way out, just after away was set, asks nothing.
export const ASK_AFTER_MS = 60_000
const QUIET_MS = BURST_GAP_SECONDS * 1000

// Activity in a main window while away. It never touches `away` or `since`: nothing clears away
// by itself. A clock set back asks at once.
export function noticed(presence: Presence, at: number): Presence {
  if (!presence.away || presence.since === null) return presence
  const last = presence.lastActive
  const setBack = at < presence.since || (last !== undefined && at < last)
  const ask =
    presence.asking ||
    setBack ||
    (presence.resting
      ? last === undefined || at - last >= QUIET_MS
      : at - presence.since >= ASK_AFTER_MS)
  return { ...presence, asking: ask, resting: !ask && presence.resting === true, lastActive: at }
}

// The human answered Not yet: the plain strip again, still away.
export function notYet(presence: Presence, at: number): Presence {
  if (presence.asking !== true) return presence
  return { ...presence, asking: false, resting: true, lastActive: at }
}

// When a question nobody answers goes back by itself: a quiet spell after the last activity.
export function quietDue(presence: Presence): number | null {
  if (presence.asking !== true || presence.lastActive === undefined) return null
  return presence.lastActive + QUIET_MS
}

export function quieted(presence: Presence, at: number): Presence {
  const due = quietDue(presence)
  if (due === null || at < due) return presence
  return { ...presence, asking: false, resting: true }
}

export function toggled(presence: Presence, at: number): Presence {
  return setAway(presence, !presence.away, at)
}

// Without a project in the orchestration mode the switch is not shown, so it cannot be turned
// away; coming back always works.
export function presenceAsked(
  presence: Presence,
  away: boolean,
  at: number,
  modesOn: readonly boolean[],
): Presence {
  if (away && !presenceShown(modesOn)) return presence
  return setAway(presence, away, at)
}

// What to post, if anything, after a change.
export function presencePost(before: Presence, after: Presence): string | null {
  if (before.away === after.away) return null
  return after.away ? AWAY_POST : BACK_POST
}

// English: read by an agent. The frame adds "[Menkar] " and the time.
export const AWAY_POST =
  'The human is away: until they are back, keep events in topics and the status file, not a chat summary each'
export const BACK_POST = 'The human is back'

export interface OrchestratorPane {
  readonly sessionId: string
  readonly running: boolean
}

// The orchestrators a post goes to: the ones running now, but the one that cleared it itself.
export function postRecipients(
  orchestrators: readonly OrchestratorPane[],
  except?: string,
): string[] {
  return orchestrators.filter((o) => o.running && o.sessionId !== except).map((o) => o.sessionId)
}

// human_back's answer, for the agent that called.
export function backTool(
  orchestrator: string | null,
  caller: string,
  presence: Presence,
): { readonly ok: boolean; readonly text: string; readonly clear: boolean } {
  if (orchestrator === null)
    return { ok: false, text: 'The orchestration mode is off in this project.', clear: false }
  if (caller !== orchestrator)
    return {
      ok: false,
      text: "Only this project's orchestrator clears the human's away state.",
      clear: false,
    }
  if (!presence.away) return { ok: true, text: 'The human is already marked here.', clear: false }
  return { ok: true, text: 'The human is marked back.', clear: true }
}

// human_away's answer, for the agent that called. Its project's mode being on is enough: the
// switch is shown while any project has it.
export function awayTool(
  orchestrator: string | null,
  caller: string,
  presence: Presence,
): { readonly ok: boolean; readonly text: string; readonly set: boolean } {
  if (orchestrator === null)
    return { ok: false, text: 'The orchestration mode is off in this project.', set: false }
  if (caller !== orchestrator)
    return {
      ok: false,
      text: "Only this project's orchestrator marks the human away.",
      set: false,
    }
  if (presence.away) return { ok: true, text: 'The human is already marked away.', set: false }
  return { ok: true, text: 'The human is marked away.', set: true }
}

// While the human is away a topic raises no sound, toast or desktop notice: it waits in the
// sidebar, and the orchestrator's summary on their return covers it. Nothing is replayed.
export function topicNoticeNow<N>(presence: Presence, notice: N | null): N | null {
  return presence.away ? null : notice
}
