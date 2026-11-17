import type { Fork } from '../types'

export const fork: Fork = { plan: (source, id) => ({ kind: 'fork', source, id }) }
