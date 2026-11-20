import type { AgentId } from '../agents/ids'
import { isDefault, kitOf } from '../agents/registry'
import type { CallerShape, ToolsFile } from './files'

// A caller is offered send_message when some installed agent it must be able to message is out
// of its own messaging's reach and can be woken by Menkar.
function shapeOf(
  caller: AgentId,
  installed: readonly AgentId[],
  wakeable: (id: AgentId) => boolean,
): CallerShape {
  const native = kitOf(caller).messaging
  return {
    sendMessage: installed.some((other) => !native?.reaches(other) && wakeable(other)),
    agents: installed,
  }
}

// What each installed agent's sessions are offered, published once the installed agents are
// known. Only an agent other than the default can change a list from the one every caller had.
export function toolsFile(
  installed: readonly AgentId[],
  wakeable: (id: AgentId) => boolean,
): ToolsFile {
  return {
    listChanged: installed.some((id) => !isDefault(id)),
    callers: Object.fromEntries(installed.map((id) => [id, shapeOf(id, installed, wakeable)])),
  }
}
