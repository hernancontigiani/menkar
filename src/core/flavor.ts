// Which Menkar this build is: `menkar`, the one the human works with every day, or `sandbox`, the
// multi-agent branch's build, installed beside it and unable to touch it (its own directories,
// files folder, lock and package). The build defines it; everything else asks here.

export type Flavor = 'menkar' | 'sandbox'

// Replaced by the build's `define`; absent under Vitest, where a test stubs it as a global.
declare const __MENKAR_FLAVOR__: string | undefined

// What a pane carries so the programs an agent runs (hooks, the statusline) know whose it is.
export const FLAVOR_ENV = 'MENKAR_FLAVOR'

export function flavor(): Flavor {
  return typeof __MENKAR_FLAVOR__ !== 'undefined' && __MENKAR_FLAVOR__ === 'sandbox'
    ? 'sandbox'
    : 'menkar'
}

const isFlavor = (value: string): value is Flavor => value === 'menkar' || value === 'sandbox'

// A build off any branch but main is a sandbox unless asked otherwise, so a package built in the
// branch's worktree is never a `menkar` one by mistake: apt would install it over the human's.
export function resolveBuildFlavor(requested: string | undefined, branch: string): Flavor {
  if (requested) {
    if (!isFlavor(requested))
      throw new Error(`MENKAR_FLAVOR_BUILD is "${requested}"; it is menkar or sandbox`)
    return requested
  }
  return branch === 'main' ? 'menkar' : 'sandbox'
}

export interface FlavorFacts {
  // The directory's name under each of the XDG homes.
  readonly dirName: string
  // The default files folder's name in the home directory.
  readonly filesFolder: string
  readonly titleKey: 'window.title' | 'window.titleSandbox'
  // The command the package installs in /usr/bin, as its own help names it.
  readonly command: string
  // Acts only on the sessions it started itself: it shares the agents' folders with the daily
  // Menkar, whose sessions it must never resume, add, trash or delete.
  readonly ownsOnly: boolean
  // Offers the integrations that write ~/.claude/settings.json. Only one statusLine fits there,
  // and the daily Menkar's is the one installed: the sandbox shows them read only.
  readonly offersSettingsFileItems: boolean
  // Classifies turns: in the sandbox that would spend the human's account on test traffic.
  readonly classifies: boolean
}

const FACTS: Readonly<Record<Flavor, FlavorFacts>> = {
  menkar: {
    dirName: 'menkar',
    filesFolder: 'Menkar',
    titleKey: 'window.title',
    command: 'menkar',
    ownsOnly: false,
    offersSettingsFileItems: true,
    classifies: true,
  },
  sandbox: {
    dirName: 'menkar-sandbox',
    filesFolder: 'Menkar-sandbox',
    titleKey: 'window.titleSandbox',
    command: 'menkar-sandbox',
    ownsOnly: true,
    offersSettingsFileItems: false,
    classifies: false,
  },
}

export function flavorFacts(): FlavorFacts {
  return FACTS[flavor()]
}

export function paneFlavorEnv(): Record<string, string> {
  return flavor() === 'menkar' ? {} : { [FLAVOR_ENV]: flavor() }
}

interface SessionAction {
  readonly type: string
  readonly session?: string
  readonly sessions?: readonly string[]
}

// The refusal for an action on a session this flavour may not touch, or null.
export function refusalFor(
  action: SessionAction,
  started: ReadonlySet<string>,
): 'sandbox.notStarted' | null {
  if (!flavorFacts().ownsOnly) return null
  const named = [
    ...(action.session === undefined ? [] : [action.session]),
    ...(action.sessions ?? []),
  ]
  return named.every((id) => started.has(id)) ? null : 'sandbox.notStarted'
}
