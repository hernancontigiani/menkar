import '@xterm/xterm/css/xterm.css'
import './style.css'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { loadCatalog, t } from './i18n'

await loadCatalog()
document.title = t('window.title')

const host = document.getElementById('terminal')
if (!host) throw new Error('the page has no #terminal element')

const terminal = new Terminal({
  fontFamily: 'monospace',
  fontSize: 14,
  cursorBlink: true,
  theme: { background: '#1e1e1e' },
})
const fit = new FitAddon()
terminal.loadAddon(fit)
terminal.open(host)
fit.fit()

window.menkar.terminal.onData((data) => terminal.write(data))
terminal.onData((data) => window.menkar.terminal.write(data))
terminal.onResize(({ cols, rows }) => window.menkar.terminal.resize({ cols, rows }))
new ResizeObserver(() => fit.fit()).observe(host)

void window.menkar.terminal.start({ cols: terminal.cols, rows: terminal.rows })
terminal.focus()
