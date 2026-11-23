// Required into the app's main process by the captures run (`-r`): every clock the app reads, in
// main, its worker threads and each window, starts at the run's fixed instant and runs on from it,
// so a capture shows the same dates and ages whatever day and hour it is taken.
const shift = Number(process.env.MENKAR_CAPTURE_CLOCK_SHIFT)
if (!Number.isFinite(shift)) throw new Error('fixed-clock: MENKAR_CAPTURE_CLOCK_SHIFT is not set')

function shiftDate(by) {
  const Real = globalThis.Date
  class Shifted extends Real {
    constructor(...args) {
      if (args.length === 0) super(Real.now() + by)
      else super(...args)
    }
    static now() {
      return Real.now() + by
    }
  }
  globalThis.Date = Shifted
}

if (process.type === 'renderer') {
  // A window's preload: the page's own world gets the shift before its first script runs.
  require('electron').contextBridge.executeInMainWorld({ func: shiftDate, args: [shift] })
} else {
  shiftDate(shift)
  const threads = require('node:worker_threads')
  if (threads.isMainThread) {
    // A worker thread does not inherit `-r`: each one requires this file itself.
    const Real = threads.Worker
    threads.Worker = class extends Real {
      constructor(file, options = {}) {
        const execArgv = [...(options.execArgv ?? process.execArgv), '--require', __filename]
        super(file, { ...options, execArgv })
      }
    }
    require('node:module').syncBuiltinESMExports()
    const { app, session } = require('electron')
    // Registered on ready before the app's own ready handler opens a window.
    app
      .whenReady()
      .then(() =>
        session.defaultSession.registerPreloadScript({ type: 'frame', filePath: __filename }),
      )
  }
}
