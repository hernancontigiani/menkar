// What last_reply answers (1.73), apart from reading the transcript.

export const REPLY_MAX_CHARS = 20_000

export function replyText(reply: string): string {
  if (reply.length <= REPLY_MAX_CHARS) return reply
  return `${reply.slice(0, REPLY_MAX_CHARS)}\n\n[Menkar: cut here; the reply is ${reply.length.toLocaleString('en-US')} characters, the first ${REPLY_MAX_CHARS.toLocaleString('en-US')} are shown.]`
}

// The session the caller named among its own project's. By name only: a renew gives a session a
// new id, so an id an agent kept names nothing a moment later.
export function sessionOfProject(
  named: string,
  sessions: readonly { readonly id: string; readonly name: string }[],
): { id: string } | { refusal: string } {
  const found = sessions.find((s) => s.name === named)
  return found ? { id: found.id } : { refusal: `No session of your project is called "${named}".` }
}
