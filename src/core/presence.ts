// The human's presence, away or here: one state for the whole app, held in memory only, so a
// quit forgets it and every start is "here". It concerns the orchestrators alone.

export interface Presence {
  readonly away: boolean
  // When the human went away; null while here.
  readonly since: number | null
}

export const HERE: Presence = { away: false, since: null }

// What the windows show: the switch only while some project has the orchestration mode on.
export interface PresenceView extends Presence {
  readonly shown: boolean
}

export function presenceShown(modesOn: readonly boolean[]): boolean {
  return modesOn.some(Boolean)
}

export function presenceView(presence: Presence, modesOn: readonly boolean[]): PresenceView {
  return { ...presence, shown: presenceShown(modesOn) }
}

// The sidebar's chip: while the mode is on somewhere, and while away even if it no longer is, so
// it can always be cleared.
export function chipShown(view: PresenceView): boolean {
  return view.shown || view.away
}

// Going away twice keeps the first time.
export function setAway(presence: Presence, away: boolean, at: number): Presence {
  if (away === presence.away) return presence
  return away ? { away: true, since: at } : HERE
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

// While the human is away a topic raises no sound, toast or desktop notice: it waits in the
// sidebar, and the orchestrator's summary on their return covers it. Nothing is replayed.
export function topicNoticeNow<N>(presence: Presence, notice: N | null): N | null {
  return presence.away ? null : notice
}
