import type { MainAgentKit } from '../types'
import { bind } from './bind'

export const mainKit: MainAgentKit = {
  settings: null,
  team: null,
  remote: null,
  waker: null,
  inbox: null,
  bind,
}
