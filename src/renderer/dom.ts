type Child = Node | string | null | undefined | false

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> & { class?: string } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue
    if (key === 'class') node.className = value
    else node.setAttribute(key, value)
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    node.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return node
}

// Drawn here, never fetched: no icon theme exists in the renderer.
const PATHS: Readonly<Record<string, string>> = {
  sidebar:
    '<rect x="2" y="3" width="12" height="10" rx="1.5"/><line x1="6" y1="3" x2="6" y2="13"/>',
  tabNew:
    '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><line x1="8" y1="5" x2="8" y2="11"/><line x1="5" y1="8" x2="11" y2="8"/>',
  tabClose:
    '<rect x="1.5" y="1.5" width="13" height="13" rx="3"/><line x1="5.5" y1="5.5" x2="10.5" y2="10.5"/><line x1="10.5" y1="5.5" x2="5.5" y2="10.5"/>',
  down: '<polyline points="4,6 8,10 12,6"/>',
  gear: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1"/>',
  more: '<circle cx="8" cy="3.5" r="0.9"/><circle cx="8" cy="8" r="0.9"/><circle cx="8" cy="12.5" r="0.9"/>',
  check: '<polyline points="3,8.5 6.5,12 13,4.5"/>',
  edit: '<path d="M10.5 2.5l3 3-8 8H2.5v-3z"/>',
  trash: '<path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.7 9h5.6l.7-9"/>',
  close: '<line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/>',
  terminal:
    '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><polyline points="4,6 6.5,8 4,10"/><line x1="8" y1="10.5" x2="11.5" y2="10.5"/>',
  list: '<circle cx="3" cy="4.5" r="0.7"/><circle cx="3" cy="8" r="0.7"/><circle cx="3" cy="11.5" r="0.7"/><line x1="6" y1="4.5" x2="13.5" y2="4.5"/><line x1="6" y1="8" x2="13.5" y2="8"/><line x1="6" y1="11.5" x2="13.5" y2="11.5"/>',
  up: '<polyline points="4,10 8,6 12,10"/>',
}

export function icon(name: keyof typeof PATHS | string, extraClass = ''): SVGSVGElement {
  const wrapper = document.createElement('span')
  wrapper.innerHTML = `<svg class="icon ${extraClass}" viewBox="0 0 16 16" aria-hidden="true">${PATHS[name] ?? ''}</svg>`
  return wrapper.firstElementChild as SVGSVGElement
}
