// A link in a terminal opens in the browser only when it is a web address: an OSC 8 hyperlink can
// name any scheme (file:, ssh:, a custom one), and those are never handed to the system.
export function webLink(uri: string): string | null {
  let url: URL
  try {
    url = new URL(uri)
  } catch (error) {
    if (error instanceof TypeError) return null // not a URL at all
    throw error
  }
  return url.protocol === 'http:' || url.protocol === 'https:' ? uri : null
}
