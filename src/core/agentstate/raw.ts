export const RAW_STATES = ['working', 'blocked', 'idle'] as const
export type RawState = (typeof RAW_STATES)[number]
