// The one list of the site's captures: the walk, the importer and the site's pages all read it, so
// no second list exists to drift. A slug names the screen, never a reading order.

export const LOCALES = ['en', 'es'] as const
export type Locale = (typeof LOCALES)[number]

export const THEMES = ['light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

export interface Clip {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface Capture {
  readonly slug: string
  readonly scene: string
  readonly clip?: Clip
  // Slugs whose image may equal this one's pixels: otherwise two equal images of one run fail it,
  // since a navigation that did not happen photographs the previous screen again.
  readonly same?: readonly string[]
}

export const CAPTURES = [
  { slug: 'hero-orchestration', scene: 'team' },
  { slug: 'work-view-awaiting', scene: 'team' },
  { slug: 'topic-discussing', scene: 'team' },
  { slug: 'task-steps', scene: 'team' },
  { slug: 'work-view-overview', scene: 'team' },
  { slug: 'board-default', scene: 'board' },
  { slug: 'task-to-review', scene: 'board' },
  { slug: 'background-workers', scene: 'workers' },
  { slug: 'peek-tab', scene: 'workers' },
  { slug: 'configure-role', scene: 'role' },
  { slug: 'project-dropdown', scene: 'harbor' },
  { slug: 'split-panes', scene: 'harbor' },
  { slug: 'first-time-card', scene: 'harbor' },
  { slug: 'markdown-preview', scene: 'notes' },
  { slug: 'add-session-existing', scene: 'notes' },
  { slug: 'add-session-new', scene: 'notes' },
  { slug: 'chat-permission', scene: 'notes' },
  { slug: 'settings-look', scene: 'settings' },
  { slug: 'settings-integrations', scene: 'settings' },
  { slug: 'usage-spend', scene: 'usage' },
  { slug: 'usage-your-time', scene: 'usage' },
  { slug: 'away-strip', scene: 'away' },
] as const satisfies readonly Capture[]

export type Slug = (typeof CAPTURES)[number]['slug']
export type Scene = (typeof CAPTURES)[number]['scene']
