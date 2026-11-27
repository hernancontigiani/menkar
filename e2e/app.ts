import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron, type ElectronApplication, type Page } from '@playwright/test'
import type { MenkarApi } from '../src/shared/ipc'
import { ensureDisplay } from './display'
import { catppuccin } from './fixtures'
import { e2ePath, foreignEntries } from './path'

export interface LaunchedApp {
  readonly root: string
  // The environment the app runs with, for a second process that must reach the same instance.
  readonly env: Readonly<Record<string, string>>
  readonly app: ElectronApplication
  readonly window: Page
  close(): Promise<void>
}

// The app runs against a throwaway HOME and XDG set, so a run never reads or writes the
// developer's own directories, and its shell starts without their rc files.
export interface LaunchOptions {
  // Fills the temporary HOME before the app starts (transcripts, a fake agent on the PATH); what
  // it returns is added to the app's environment.
  readonly prepare?: (dirs: {
    readonly root: string
    readonly home: string
  }) =>
    | Readonly<Record<string, string>>
    | undefined
    | Promise<Readonly<Record<string, string>> | undefined>
  // Chromium switches added to the launch, such as a fixed device scale factor.
  readonly args?: readonly string[]
}

export async function launchApp(options: LaunchOptions = {}): Promise<LaunchedApp> {
  // Set only by `npm run ui-check` and `npm run package:smoke`, inside xvfb-run: a run started
  // any other way would open its window on the developer's screen.
  if (process.env.MENKAR_E2E_XVFB !== '1') {
    throw new Error(
      'e2e runs only through `npm run ui-check` (xvfb-run); refusing to open a window here',
    )
  }
  await ensureDisplay()
  const root = mkdtempSync(join(tmpdir(), 'menkar-e2e-'))
  const home = join(root, 'home')
  mkdirSync(home)
  const extraEnv = (await options.prepare?.({ root, home })) ?? {}
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value
  }
  Object.assign(env, {
    HOME: home,
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_DATA_HOME: join(root, 'data'),
    SHELL: '/bin/bash',
    PATH: e2ePath(root),
    ...extraEnv,
  })
  const foreign = foreignEntries(env.PATH ?? '', root, resolve('.'))
  if (foreign.length > 0) {
    rmSync(root, { recursive: true, force: true })
    throw new Error(`e2e PATH reaches the machine's own folders: ${foreign.join(', ')}`)
  }
  delete env.ELECTRON_RENDERER_URL
  // On a Wayland desktop Electron would open its window on the developer's screen and ignore
  // xvfb-run's DISPLAY.
  delete env.WAYLAND_DISPLAY
  env.XDG_SESSION_TYPE = 'x11'
  // MENKAR_E2E_EXECUTABLE runs the suite against a packaged build instead of `out/`.
  const executable = process.env.MENKAR_E2E_EXECUTABLE
  const args = ['--ozone-platform=x11', ...(options.args ?? [])]
  const launch = () =>
    _electron.launch(
      executable ? { executablePath: executable, args, env } : { args: [...args, '.'], env },
    )
  // ETXTBSY: the kernel refused to run Electron's binary while some process held it open for
  // writing. No test writes it, yet a hosted runner refused it once at the suite's start, so it is
  // tried once more after a pause. Any other failure is the test's.
  const app = await launch().catch(async (error: unknown) => {
    if (!String(error).includes('ETXTBSY')) throw error
    await new Promise((done) => setTimeout(done, 500))
    return launch()
  })
  const window = await app.firstWindow()
  // The first window exists before its script runs: a key or a click sent earlier finds no
  // handler and is lost. The header's Settings button is built just before the key handlers.
  await window.waitForSelector('#settings-button', { state: 'attached' })
  return {
    root,
    env,
    app,
    window,
    async close() {
      await endSessions(app)
      await app.close()
      rmSync(root, { recursive: true, force: true })
    },
  }
}

// A running agent makes closing the window ask: a test's end closes its tabs first, then stops
// the orchestrator's workers Close all leaves running in the background.
export async function endSessions(app: ElectronApplication): Promise<void> {
  for (const page of app.windows()) {
    await page
      .evaluate(async () => {
        const menkar = (
          globalThis as unknown as {
            menkar?: {
              window: {
                act(a: { type: string; session?: string }): Promise<unknown>
                state(): Promise<{ open: readonly string[] }>
              }
            }
          }
        ).menkar
        if (!menkar) return
        await menkar.window.act({ type: 'closeAllTabs' })
        for (const session of (await menkar.window.state()).open)
          await menkar.window.act({ type: 'stopSession', session })
      })
      .catch(() => undefined)
  }
}

export async function terminalText(window: Page): Promise<string> {
  const rows = await window.locator('.xterm-rows > div').allTextContents()
  return rows.join('\n')
}

// What a pane's agent has written so far, as the main process holds it. The rows of a tab not
// shown are no proof of an agent's output: xterm does not draw a terminal whose element is hidden,
// so a tab hidden before its first frame keeps blank rows long after its agent printed.
export function paneOutput(window: Page, pane: string): Promise<string> {
  return window.evaluate(
    async (id) =>
      (await (globalThis as unknown as { menkar: MenkarApi }).menkar.panes.attach(id)).buffer,
    pane,
  )
}

// Every agent pane's output, in the order of the window's tabs and their panes.
export async function panesOutput(window: Page): Promise<string[]> {
  const panes = await window.evaluate(async () => {
    const s = await (globalThis as unknown as { menkar: MenkarApi }).menkar.window.state()
    return s?.tabs.flatMap((tab) => tab.panes.map((p) => p.id)) ?? []
  })
  return Promise.all(panes.map((pane) => paneOutput(window, pane)))
}

// A start that reopens one saved tab: a Cursor session whose stand-in `cursor-agent` replaces
// itself with a plain bash, so the tab shows a shell prompt. Never the real agent. Cursor, because
// its command carries no `--settings` and so writes nothing into the config directory.
export const CURSOR_SESSION = 'c0ffee01'

export function savedCursorTab(
  dirs: { readonly root: string; readonly home: string },
  settings: Readonly<Record<string, unknown>> = {},
  // The session's folder, made if missing; HOME unless given.
  cwd: string = dirs.home,
): Record<string, string> {
  mkdirSync(cwd, { recursive: true })
  const bin = join(dirs.root, 'bin')
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, 'cursor-agent'), '#!/bin/sh\nexec /bin/bash --norc --noprofile -i\n')
  chmodSync(join(bin, 'cursor-agent'), 0o755)
  const folder = cwd.slice(1).replace(/[^A-Za-z0-9]/g, '-')
  const transcripts = join(
    dirs.home,
    '.cursor',
    'projects',
    folder,
    'agent-transcripts',
    CURSOR_SESSION,
  )
  mkdirSync(transcripts, { recursive: true })
  writeFileSync(
    join(transcripts, `${CURSOR_SESSION}.jsonl`),
    `${JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: '<user_query>hello</user_query>' }] } })}\n`,
  )
  const config = join(dirs.root, 'config', 'menkar')
  mkdirSync(config, { recursive: true })
  const project = 'aaaaaaaaaaaa'
  writeFileSync(
    join(config, 'projects.json'),
    JSON.stringify({
      version: 1,
      current: project,
      projects: [{ id: project, name: 'Default', members: [CURSOR_SESSION], groups: [] }],
      windows: [
        {
          current: project,
          tabs: { [project]: [{ panes: [CURSOR_SESSION], orientation: 'horizontal' }] },
        },
      ],
    }),
  )
  writeFileSync(
    join(config, 'state.json'),
    JSON.stringify({
      settings: {
        terminal_theme: catppuccin(settings.color_scheme),
        terminal_colors: 'theme',
        ...settings,
      },
    }),
  )
  return { PATH: e2ePath(dirs.root, bin) }
}

// What the app saved in its state.json: nothing until something is saved, so a fresh start has none.
export function savedState(root: string) {
  const file = join(root, 'config', 'menkar', 'state.json')
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
}
