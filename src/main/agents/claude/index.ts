import { sessionSettingsFile } from '../../context'
import type { MainAgentKit } from '../types'
import { remote } from './remote'
import { waker } from './waker'

export const mainKit: MainAgentKit = {
  settings: sessionSettingsFile,
  team: { tell: waker.wake },
  remote,
  waker,
}
