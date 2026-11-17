// §2.3 of the multi-agent architecture: what a worker's closed turn says to its parent is read
// from its transcript by its agent's catalog. Claude's is the last-reply reader's; Cursor's turns
// are not read, so a Cursor worker wakes no parent, as before.
import { describe, expect, test } from 'vitest'
import { kitOf } from '../../../../src/core/agents/registry'
import { onlyTeamUpdates, reportClosedTurn } from '../../../../src/core/sessions/lastreply'

describe("a worker's closed turn", () => {
  test("Claude's catalog reads it with the last-reply reader", () => {
    expect(kitOf('claude').catalog.turnEnd).toEqual({
      onlyTeamUpdates,
      reportedTo: reportClosedTurn,
    })
  })

  test("Cursor's is not read", () => {
    expect(kitOf('cursor').catalog.turnEnd).toBeNull()
  })
})
