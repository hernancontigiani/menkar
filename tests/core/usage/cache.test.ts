// The usage cache's rebuild when two openers meet.
import { expect, test } from 'vitest'
import { rebuildCache, UsageCache } from '../../../src/core/usage/cache'
import { usageDirs } from '../../factories/usage'

// A poller opens the cache every minute beside the app: two openers of an old cache may both read
// its schema as stale, and the second rebuild must not drop what the first opener's pass ingested.
test('a cache another opener already rebuilt is not rebuilt again', () => {
  const dirs = usageDirs('rebuild')
  const cache = new UsageCache(dirs.cache)
  cache.db.raw.exec("INSERT INTO names VALUES ('s1', 'kept', 1)")
  rebuildCache(cache.db)
  expect(cache.db.raw.prepare('SELECT name FROM names').all()).toEqual([{ name: 'kept' }])
  cache.close()
})
