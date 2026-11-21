import { sessionSettingsFile } from '../../context'
import type { MainAgentKit } from '../types'
import { inbox } from './inbox'
import { remote } from './remote'
import { waker } from './waker'

export const mainKit: MainAgentKit = {
  settings: sessionSettingsFile,
  team: { tell: waker.wake },
  remote,
  waker,
  inbox,
  bind: null,
  namer: null,
  callers: null,
}
