// A topic's desktop notice stays in the tray, and so in the dock's count, only while the topic is
// open, not seen, and its project in the mode: a topic closed before the human saw it, a project
// switched off or deleted, must not leave a count nobody can clear.
import { describe, expect, test } from 'vitest'
import { NotificationTray } from '../../../src/core/agentstate/tray'
import { closeStaleTopicNotices, topicKey } from '../../../src/core/orchestration/notices'
import {
  addTopic,
  closeTopic,
  emptyTopics,
  markSeen,
  type Topics,
} from '../../../src/core/orchestration/topics'

const AT = '2026-11-12T23:59:30.000-03:00'

class Notice {
  closed = false
  close(): void {
    this.closed = true
  }
}

function raised(project = 'p1'): {
  topics: Topics
  tray: NotificationTray<Notice>
  notice: Notice
} {
  const topics = addTopic(
    emptyTopics(),
    project,
    { title: 'Pick a port', context: '', from: 'O', blocking: false },
    AT,
  ).topics
  const tray = new NotificationTray<Notice>()
  const notice = new Notice()
  tray.show(topicKey(project, 1), notice)
  return { topics, tray, notice }
}

const on = () => true

describe('topic notices in the tray', () => {
  test('add → its notice stays; closed with topic_close before being seen → the tray is empty', () => {
    const { topics, tray, notice } = raised()
    closeStaleTopicNotices(tray, topics, on)
    expect(tray.size).toBe(1)
    const closed = closeTopic(topics, 'p1', 1, 'port 8080', AT)?.topics ?? topics
    closeStaleTopicNotices(tray, closed, on)
    expect(tray.size).toBe(0)
    expect(notice.closed).toBe(true)
  })

  test('seen → closed', () => {
    const { topics, tray } = raised()
    closeStaleTopicNotices(tray, markSeen(topics, 'p1', 1), on)
    expect(tray.size).toBe(0)
  })

  test('the mode switched off, or the project deleted → closed', () => {
    const off = raised()
    closeStaleTopicNotices(off.tray, off.topics, () => false)
    expect(off.tray.size).toBe(0)
    const gone = raised('p2')
    closeStaleTopicNotices(gone.tray, gone.topics, (id) => id === 'p1')
    expect(gone.tray.size).toBe(0)
  })

  test("an agent's notice in the same tray is left alone", () => {
    const { topics, tray } = raised()
    tray.show('a-session-id', new Notice())
    closeStaleTopicNotices(tray, closeTopic(topics, 'p1', 1, 'done', AT)?.topics ?? topics, on)
    expect(tray.size).toBe(1)
  })
})
