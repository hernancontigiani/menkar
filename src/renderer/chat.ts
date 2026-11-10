import { matchShortcut } from '../core/shortcuts'
import './chat.css'
import { renderMarkdown } from '../core/chat/markdown'
import { ChatModel, type Item } from '../core/chat/model'
import { AGENT_NAMES, variantOf } from '../core/chat/variants'
import { el } from './dom'
import { t } from './i18n'

// A chat tab's body: a banner, the conversation, the compose row. It renders into the container it
// is given and returns what unmounts it; the tab around it is the window's.

// The view follows the bottom while the user is within this many pixels of it.
const FOLLOW_PX = 48

function itemNode(
  item: Item,
  name: string,
  answer: (requestId: string, choice: 'once' | 'always' | 'deny') => void,
): HTMLElement {
  switch (item.kind) {
    case 'user':
      return el('div', { class: 'bubble user' }, item.text)
    case 'assistant': {
      const bubble = el('div', { class: 'bubble assistant' })
      for (const block of renderMarkdown(item.text)) {
        if (block.kind === 'code') bubble.append(el('pre', {}, block.text))
        else {
          const line = el('div', { class: 'md-line' })
          for (const span of block.spans) {
            line.append(
              span.code
                ? el('code', {}, span.text)
                : span.bold
                  ? el('b', {}, span.text)
                  : span.text,
            )
          }
          bubble.append(line)
        }
      }
      return bubble
    }
    case 'tool':
      return el('div', { class: 'chip' }, t('chat.tool', { tool: item.name }))
    case 'outcome': {
      const tool = item.tool
      const text =
        item.outcome === 'allowed'
          ? t('chat.allowed', { tool })
          : item.outcome === 'always'
            ? t('chat.alwaysAllowing', { tool })
            : item.outcome === 'denied'
              ? t('chat.denied', { tool })
              : t('chat.autoAllowed', { tool })
      return el('div', { class: 'chip' }, text)
    }
    case 'card': {
      const deny = el('button', { 'data-answer': 'deny' }, t('chat.deny'))
      const always = el(
        'button',
        { 'data-answer': 'always' },
        t('chat.alwaysAllow', { tool: item.tool }),
      )
      const once = el('button', { class: 'suggested', 'data-answer': 'once' }, t('chat.allowOnce'))
      deny.addEventListener('click', () => answer(item.requestId, 'deny'))
      always.addEventListener('click', () => answer(item.requestId, 'always'))
      once.addEventListener('click', () => answer(item.requestId, 'once'))
      return el(
        'div',
        { class: 'card permission', 'data-request': item.requestId },
        el('div', { class: 'card-title' }, t('chat.wantsToUse', { name, tool: item.title })),
        item.body ? el('div', { class: 'card-body dim' }, item.body) : null,
        el('div', { class: 'card-buttons' }, deny, always, once),
      )
    }
    case 'notice': {
      const text =
        item.notice === 'continuing'
          ? t('chat.continuing')
          : item.notice === 'rateLimited'
            ? t('chat.rateLimited')
            : item.notice === 'ended'
              ? t('chat.ended')
              : t('chat.error', { msg: item.text ?? '' })
      return el('div', { class: 'notice dim' }, text)
    }
  }
}

export async function mountChat(container: HTMLElement, chatId: string): Promise<() => void> {
  const api = window.menkar.chat
  const info = await api.info(chatId)
  const variant = info ? variantOf(info.agent, info.key) : undefined
  if (!info || !variant) return () => {}
  const name = AGENT_NAMES[info.agent]
  const model = new ChatModel(variant, info.continuing)
  const banner = !variant.writeable
    ? t('chat.bannerReadOnly', { name })
    : variant.gated
      ? t('chat.bannerGated', { name })
      : t('chat.bannerAuto', { name })
  const conversation = el('div', { class: 'conversation', 'data-chat': chatId })
  const entry = el('input', {
    type: 'text',
    placeholder: t('chat.placeholder', { name }),
    'data-key': 'chat-entry',
  })
  const stop = el('button', { title: t('chat.stop'), 'data-key': 'chat-stop', hidden: '' }, '■')
  const send = el(
    'button',
    { class: 'suggested', title: t('chat.send'), 'data-key': 'chat-send' },
    '➤',
  )
  const root = el(
    'div',
    { class: 'chat' },
    el('div', { class: 'banner dim' }, banner),
    conversation,
    el('div', { class: 'compose' }, entry, stop, send),
  )
  let following = true
  let scheduled = false
  conversation.addEventListener('scroll', () => {
    following =
      conversation.scrollHeight - conversation.scrollTop - conversation.clientHeight <= FOLLOW_PX
  })
  const answer = (requestId: string, choice: 'once' | 'always' | 'deny') => {
    const reply = model.answer(requestId, choice)
    if (reply) void api.reply(chatId, reply, t('chat.declined'))
    draw()
  }
  function draw(): void {
    const nodes = model.items.map((item) => itemNode(item, name, answer))
    if (model.thinking)
      nodes.push(el('div', { class: 'bubble assistant thinking' }, t('chat.thinking', { name })))
    conversation.replaceChildren(...nodes)
    send.disabled = model.busy || model.ended
    entry.disabled = model.ended
    stop.hidden = !model.busy
    // Following the bottom is applied at most every 60 ms.
    if (following && !scheduled) {
      scheduled = true
      setTimeout(() => {
        scheduled = false
        if (following) conversation.scrollTop = conversation.scrollHeight
      }, 60)
    }
  }
  const submit = () => {
    const text = model.send(entry.value)
    if (text === null) return
    entry.value = ''
    void api.send(chatId, text)
    draw()
  }
  entry.addEventListener('keydown', (event) => {
    if (matchShortcut('chat', event) === 'chatSend') {
      event.preventDefault()
      submit()
    }
  })
  send.addEventListener('click', submit)
  stop.addEventListener('click', () => void api.stop(chatId))
  const unsubscribe = api.onEvent(({ chatId: id, event }) => {
    if (id !== chatId) return
    if (event.kind === 'ended') model.end()
    else {
      const reply = model.apply(event)
      if (reply) void api.reply(chatId, reply, t('chat.declined'))
    }
    draw()
  })
  container.replaceChildren(root)
  draw()
  entry.focus()
  return () => {
    unsubscribe()
    root.remove()
  }
}
