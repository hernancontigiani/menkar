import { BrowserWindow } from 'electron'

// Interface size: every window's page zoom, so Menkar's own text and controls scale together
// (the styles are in pixels). Each window starts at it, and a change reaches every open one.
let factor = 1

export function uiZoom(): number {
  return factor
}

export function setUiZoom(percent: number): void {
  factor = percent / 100
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.setZoomFactor(factor)
  }
}
