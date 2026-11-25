import type { MainAgentKit } from '../types'
import { bind } from './bind'
import { namer } from './namer'
import { teller, waker } from './waker'

export const mainKit: MainAgentKit = {
  settings: null,
  team: teller,
  remote: null,
  waker,
  inbox: null,
  bind,
  namer,
  callers: null,
  prepare: null,
  runs: null,
}
