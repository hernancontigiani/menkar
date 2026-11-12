// The topics the orchestrator keeps for the human: numbered per project and never reused, shown
// open first by the ★ of whoever raised them, and kept with their decision once closed.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { beforeEach, describe, expect, test } from 'vitest'
import {
  addTopic,
  closeTopic,
  emptyTopics,
  loadTopics,
  parseTopics,
  saveTopics,
  serializeTopics,
  shownTopics,
  type Topics,
  topicsOf,
  topicTool,
  updateTopic,
} from '../../../src/core/orchestration/topics'
import { topicsPath } from '../../../src/core/paths'

const AT = '2026-11-12T23:59:30.000-03:00'
const LATER = '2026-11-13T00:00:10.000-03:00'

const add = (t: Topics, from: string, title: string, blocking = false, project = 'p1') =>
  addTopic(t, project, { title, context: `about ${title}`, from, blocking }, AT).topics

beforeEach(async () => {
  await rm(dirname(topicsPath()), { recursive: true, force: true })
  await mkdir(dirname(topicsPath()), { recursive: true })
})

describe('topics', () => {
  test('numbers are never reused: add 1, 2; close 2; add → 3', () => {
    let t = add(add(emptyTopics(), 'A', 'one'), 'A', 'two')
    t = closeTopic(t, 'p1', 2, 'done', LATER)?.topics ?? t
    const third = addTopic(t, 'p1', { title: 'three', context: '', from: 'A', blocking: false }, AT)
    expect(third.number).toBe(3)
    expect(topicsOf(third.topics, 'p1').map((x) => x.number)).toEqual([1, 2, 3])
    expect(
      addTopic(t, 'p2', { title: 'x', context: '', from: 'A', blocking: false }, AT).number,
    ).toBe(1)
  })

  test('shown: open and discussing only, ★ sessions first, then by number; blocking is not moved', () => {
    let t = add(emptyTopics(), 'A', 'one')
    t = add(t, 'B', 'two', true)
    t = add(t, 'A', 'three')
    t = closeTopic(t, 'p1', 3, 'trash', LATER)?.topics ?? t
    const project = { orchestration: { priority: ['B'] } }
    expect(shownTopics(project, topicsOf(t, 'p1')).map((x) => x.number)).toEqual([2, 1])
    t = add(t, 'A', 'four', true)
    expect(shownTopics({}, topicsOf(t, 'p1')).map((x) => x.number)).toEqual([1, 2, 4])
  })

  test('a closed topic keeps its decision, and `all` lists it', () => {
    let t = add(add(add(emptyTopics(), 'A', 'one'), 'A', 'two'), 'A', 'three')
    t = closeTopic(t, 'p1', 3, 'trash', LATER)?.topics ?? t
    const all = shownTopics({}, topicsOf(t, 'p1'), true)
    expect(all.map((x) => [x.number, x.status, x.decision])).toEqual([
      [1, 'open', undefined],
      [2, 'open', undefined],
      [3, 'closed', 'trash'],
    ])
    expect(all[2]?.updated).toBe(LATER)
    expect(all[2]?.created).toBe(AT)
  })

  test('update changes only what it is given; a number another project has is not found', () => {
    const t = add(emptyTopics(), 'A', 'one')
    const u = updateTopic(t, 'p1', 1, { status: 'discussing', blocking: true }, LATER)
    expect(topicsOf(u?.topics ?? t, 'p1')[0]).toMatchObject({
      title: 'one',
      status: 'discussing',
      blocking: true,
      updated: LATER,
    })
    expect(updateTopic(t, 'p2', 1, { title: 'x' }, LATER)).toBeNull()
    expect(closeTopic(t, 'p1', 9, 'x', LATER)).toBeNull()
  })

  test('the file round-trips; a topic of the wrong shape is dropped, and next never goes back', async () => {
    const t = add(add(emptyTopics(), 'A', 'one'), 'B', 'two', true)
    await saveTopics(t)
    expect((await loadTopics()).topics).toEqual(t)
    const raw = serializeTopics(t) as {
      projects: Record<string, { next: number; topics: unknown[] }>
    }
    const p1 = raw.projects.p1
    if (!p1) throw new Error('no p1')
    const read = parseTopics({
      ...raw,
      projects: { p1: { next: 1, topics: [...p1.topics, { number: 'x' }, 7] } },
    })
    expect(topicsOf(read, 'p1').map((x) => x.number)).toEqual([1, 2])
    expect(
      addTopic(read, 'p1', { title: 'n', context: '', from: 'A', blocking: false }, AT).number,
    ).toBe(3)
  })

  test('an unreadable file is moved aside, never deleted, and an empty store starts', async () => {
    await writeFile(topicsPath(), '{ broken')
    const loaded = await loadTopics()
    expect(loaded.topics).toEqual(emptyTopics())
    expect(loaded.movedTo).toMatch(/^topics\.json\.broken-/)
    expect(await readFile(`${dirname(topicsPath())}/${loaded.movedTo}`, 'utf8')).toBe('{ broken')
    expect(await readdir(dirname(topicsPath()))).toEqual([loaded.movedTo])
  })
})

describe('the topic tools', () => {
  const call = (topics: Topics, caller = 'A') => ({
    topics,
    projectId: 'p1',
    caller,
    priority: ['B'],
    nameOf: (id: string) => ({ A: 'api', B: 'fabric' })[id] ?? id,
    at: AT,
  })

  test('add, list, update, close: each answers in a sentence and returns the topics to keep', () => {
    const one = topicTool(
      'topic_add',
      { title: 'Schema', context: 'Which one?' },
      call(emptyTopics()),
    )
    expect(one.text).toBe('Topic 1 added.')
    const two = topicTool(
      'topic_add',
      { title: 'Deploy', context: 'Now?', blocking: true },
      call(one.topics ?? emptyTopics(), 'B'),
    )
    const t = two.topics ?? emptyTopics()
    expect(topicTool('topic_list', {}, call(t)).text).toBe(
      '2. ★ Deploy · from fabric · blocking · open\n   Now?\n1. Schema · from api · open\n   Which one?',
    )
    const u = topicTool('topic_update', { number: 1, status: 'discussing' }, call(t))
    expect(u.text).toBe('Topic 1 updated.')
    const c = topicTool('topic_close', { number: 2, decision: 'tomorrow' }, call(u.topics ?? t))
    expect(topicTool('topic_list', { all: true }, call(c.topics ?? t)).text).toContain(
      'closed · decision: tomorrow',
    )
  })

  test('refusals: no title, no number, a status it cannot set, a number of another project', () => {
    const t =
      topicTool('topic_add', { title: 'x', context: '' }, call(emptyTopics())).topics ??
      emptyTopics()
    expect(topicTool('topic_add', { context: 'c' }, call(t)).ok).toBe(false)
    expect(topicTool('topic_update', { title: 'y' }, call(t)).ok).toBe(false)
    expect(topicTool('topic_update', { number: 1, status: 'closed' }, call(t)).ok).toBe(false)
    expect(topicTool('topic_close', { number: 1 }, call(t)).ok).toBe(false)
    const other = { ...call(t), projectId: 'p2' }
    expect(topicTool('topic_close', { number: 1, decision: 'd' }, other)).toEqual({
      ok: false,
      text: 'This project has no topic 1.',
    })
  })
})
