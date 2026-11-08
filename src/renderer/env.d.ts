import type { MenkarApi } from '../shared/ipc'

declare global {
  interface Window {
    readonly menkar: MenkarApi
  }
}
