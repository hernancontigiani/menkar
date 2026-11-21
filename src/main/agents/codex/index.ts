import type { MainAgentKit } from '../types'
import { bind } from './bind'
import { namer } from './namer'
import { waker } from './waker'

export const mainKit: MainAgentKit = {
  settings: null,
  team: { tell: waker.wake },
  remote: null,
  waker,
  inbox: null,
  bind,
  namer,
}
