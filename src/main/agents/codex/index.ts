import type { MainAgentKit } from '../types'
import { bind } from './bind'
import { namer } from './namer'
import { waker } from './waker'

export const mainKit: MainAgentKit = {
  settings: null,
  team: null,
  remote: null,
  waker,
  inbox: null,
  bind,
  namer,
}
