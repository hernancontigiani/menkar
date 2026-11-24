import { sessionSettingsFile } from '../../context'
import type { MainAgentKit } from '../types'
import { inbox } from './inbox'
import { remote } from './remote'
import { teller, waker } from './waker'

export const mainKit: MainAgentKit = {
  settings: sessionSettingsFile,
  team: teller,
  remote,
  waker,
  inbox,
  bind: null,
  namer: null,
  callers: null,
  prepare: null,
  runs: null,
}
