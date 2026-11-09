import { describe, expect, it } from 'vitest'
import { tilde } from '../../src/core/tilde'

describe('a path under home reads ~/…', () => {
  it('SES-30 by the home folder’s prefix, whatever its depth', () => {
    expect(tilde('/home/demo/projects/api', '/home/demo')).toBe('~/projects/api')
    expect(tilde('/tmp/menkar-e2e-x/home/work/api', '/tmp/menkar-e2e-x/home')).toBe('~/work/api')
    expect(tilde('/Users/ana/site', '/Users/ana/')).toBe('~/site')
    expect(tilde('/home/demo', '/home/demo')).toBe('~')
  })

  it('SES-30 leaves a path outside home, or a sibling sharing its prefix, as it is', () => {
    expect(tilde('/home/demonstration/x', '/home/demo')).toBe('/home/demonstration/x')
    expect(tilde('/srv/app', '/home/demo')).toBe('/srv/app')
    expect(tilde('/srv/app', '')).toBe('/srv/app')
  })
})
