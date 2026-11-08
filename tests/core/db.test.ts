import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { openDb } from '../../src/core/db'

const path = (name: string) => join(process.env.MENKAR_TEST_ROOT ?? '', 'db', name)

describe('db', () => {
  test('a transaction that throws leaves nothing behind; one that returns is kept', () => {
    const db = openDb(path('tx.sqlite'))
    try {
      db.raw.exec('CREATE TABLE turns (n INTEGER)')
      expect(() =>
        db.transaction(() => {
          db.raw.prepare('INSERT INTO turns VALUES (1)').run()
          throw new Error('midway')
        }),
      ).toThrow('midway')
      expect(
        db.transaction(() => db.raw.prepare('INSERT INTO turns VALUES (2)').run().changes),
      ).toBe(1)
      expect(db.raw.prepare('SELECT n FROM turns').all()).toEqual([{ n: 2 }])
    } finally {
      db.close()
    }
  })

  test('user_version starts at zero and survives a reopen', () => {
    const file = path('version.sqlite')
    const first = openDb(file)
    expect(first.userVersion()).toBe(0)
    first.setUserVersion(3)
    first.close()
    const second = openDb(file)
    expect(second.userVersion()).toBe(3)
    expect(() => second.setUserVersion(1.5)).toThrow(RangeError)
    second.close()
  })

  test('the database waits for a busy lock instead of failing at once', () => {
    const db = openDb(path('busy.sqlite'), 1234)
    expect(db.raw.prepare('PRAGMA busy_timeout').get()).toEqual({ timeout: 1234 })
    db.close()
  })
})
