import type { MainAgentKit } from '../types'
import { CursorWakes } from './waker'

const wakes = new CursorWakes()

export const mainKit: MainAgentKit = {
  settings: null,
  team: wakes.teller,
  remote: null,
  waker: wakes.waker,
  inbox: null,
  bind: null,
  namer: null,
  callers: null,
  prepare: null,
  runs: null,
}
