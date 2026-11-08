// The Usage window's month stepper: which month is shown and which arrows work. No Node import.

export interface Month {
  readonly year: number
  readonly month: number // 1–12
}

export interface StepperState {
  readonly month: Month
  readonly all: boolean
}

const index = (m: Month) => m.year * 12 + (m.month - 1)
const fromIndex = (i: number): Month => ({ year: Math.floor(i / 12), month: (i % 12) + 1 })

export function shiftMonth(m: Month, by: number): Month {
  return fromIndex(index(m) + by)
}

// ‹ stops at the month of the history's first turn (never, with an empty history), › at the
// current month; both are off while All is on.
export function arrows(
  state: StepperState,
  firstMonth: Month | null,
  current: Month,
): { readonly previous: boolean; readonly next: boolean } {
  if (state.all) return { previous: false, next: false }
  return {
    previous: firstMonth === null || index(state.month) > index(firstMonth),
    next: index(state.month) < index(current),
  }
}

// Pressing an arrow while All is on turns All off and shows the stepped month.
export function step(state: StepperState, by: -1 | 1): StepperState {
  return { month: shiftMonth(state.month, by), all: false }
}
