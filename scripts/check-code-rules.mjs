// Rules about the shape of the code, checked by parsing the sources with the TypeScript compiler
// API: a grep would miss `globalThis.Date.now` spelled over two lines and flag the words inside a
// comment or a string.
import { readdirSync, readFileSync } from 'node:fs'
import { join, posix, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const CLOCK = 'src/core/clock.ts'
const LOG = 'src/core/log.ts'
const ANY_REASON = /biome-ignore lint\/suspicious\/noExplicitAny: \S/
const AGENTS_CORE = 'src/core/agents'
const AGENTS_MAIN = 'src/main/agents'
const IDS = `${AGENTS_CORE}/ids.ts`
const DESCRIPTORS = `${AGENTS_CORE}/descriptors.ts`
const REGISTRIES = [`${AGENTS_CORE}/registry.ts`, `${AGENTS_MAIN}/registry.ts`]
const DEFAULTS = new Set(['DEFAULT_AGENT', 'CLASSIFIER_AGENT'])
const AGENT_RULES = new Set([
  'agent-literal',
  'agent-property',
  'agent-identifier',
  'agent-import',
  'agent-default',
  'descriptors-node-free',
])

/**
 * Sites of the agent rules that are known, counted per file and rule. A file fails when it has more
 * hits than its entry, so a count only goes down: each block that moves an agent's code behind its
 * kit lowers the entries of the files it owns.
 * @type {Readonly<Record<string, Readonly<Record<string, { count: number, reason: string }>>>>}
 */
export const ALLOWED = {
  'src/core/agents.ts': {
    'agent-literal': {
      count: 2,
      reason: "moved in P0.7: removed, its commands are the descriptors'",
    },
    'agent-property': {
      count: 2,
      reason: "moved in P0.7: removed, its commands are the descriptors'",
    },
  },
  'src/core/agentstate/mirror.ts': {
    'agent-identifier': { count: 1, reason: "permanent: the terminal's cursor row, not the agent" },
  },
  'src/core/chat/processes.ts': {
    'agent-identifier': { count: 2, reason: 'moved in P0.7' },
    'agent-literal': { count: 2, reason: 'moved in P0.7' },
    'agent-property': { count: 6, reason: 'moved in P0.7' },
  },
  'src/core/chat/protocol.ts': {
    'agent-identifier': { count: 4, reason: 'moved in P0.7' },
  },
  'src/core/chat/variants.ts': {
    'agent-literal': { count: 7, reason: 'moved in P0.7' },
    'agent-property': { count: 4, reason: 'moved in P0.7' },
  },
  'src/core/classifier/input.ts': {
    'agent-identifier': { count: 1, reason: 'moved in P0.7' },
  },
  'src/core/classifier/run.ts': {
    'agent-identifier': { count: 2, reason: 'moved in P0.7' },
    'agent-literal': { count: 1, reason: 'moved in P0.7' },
  },
  'src/core/context/files.ts': {
    'agent-identifier': { count: 1, reason: 'moved in P0.7' },
  },
  'src/core/context/integrations.ts': {
    'agent-identifier': { count: 1, reason: 'moved in P0.7' },
  },
  'src/core/files/check.ts': {
    'agent-identifier': {
      count: 3,
      reason: "moved in P0.7: Claude's data guarded read only (not in that block's file list yet)",
    },
  },
  'src/core/paths.ts': {
    'agent-identifier': {
      count: 12,
      reason:
        "P0.7 or later: tests/core/paths.test.ts asserts claudeProjects; the other members belong to other blocks' files",
    },
  },
  'src/core/sessions/info.ts': {
    'agent-identifier': {
      count: 1,
      reason: 'moved in P0.7: SessionInfo.claudeNamed is read by the renderer and main',
    },
  },
  'src/core/sessions/service.ts': {
    'agent-identifier': {
      count: 1,
      reason: 'moved in P0.7: SessionInfo.claudeNamed is read by the renderer and main',
    },
  },
  'src/core/team/version.ts': {
    'agent-identifier': {
      count: 1,
      reason:
        'permanent: tests/core/team/version.test.ts imports claudeVersion/TEAM_FLOOR/teamFlagsAllowed from it, and tests/core/team/** stays unchanged',
    },
  },
  'src/core/usage/cache.ts': {
    'agent-identifier': {
      count: 1,
      reason: 'moved in P0.7: the TypeScript property becomes `given`',
    },
    'agent-literal': {
      count: 2,
      reason: "permanent: the history's SQL column `claude`, kept for its bytes",
    },
    'agent-property': {
      count: 3,
      reason: 'moved in P0.7: the TypeScript property becomes `given`',
    },
  },
  'src/core/usage/history.ts': {
    'agent-identifier': {
      count: 1,
      reason: 'moved in P0.7: the TypeScript property becomes `given`',
    },
    'agent-literal': {
      count: 1,
      reason: "permanent: the history's SQL column `claude`, kept for its bytes",
    },
  },
  'src/core/usage/pass.ts': {
    'agent-identifier': {
      count: 2,
      reason: "P1a.6: TurnSource replaces PassPaths' root",
    },
  },
  'src/main/workspace.ts': {
    'agent-literal': { count: 20, reason: 'moved in P0.6' },
    'agent-property': { count: 2, reason: 'moved in P0.6: installedAgents from the registry' },
  },
  'src/renderer/addsession.ts': {
    'agent-literal': { count: 12, reason: 'moved in P0.7' },
  },
  'src/renderer/app.ts': {
    'agent-literal': { count: 3, reason: 'moved in P0.7' },
  },
  'src/renderer/integrations.ts': {
    'agent-identifier': {
      count: 1,
      reason: "moved in P0.7: Claude's settings switch (not in that block's file list yet)",
    },
  },
  'src/renderer/orchestration.ts': {
    'agent-literal': { count: 1, reason: 'moved in P0.7' },
  },
  'src/renderer/sessionmenus.ts': {
    'agent-literal': { count: 2, reason: 'moved in P0.7' },
  },
  'src/renderer/switcher.ts': {
    'agent-property': {
      count: 2,
      reason: "moved in P0.7: labels from the descriptors (not in that block's file list yet)",
    },
  },
  'src/renderer/terminals.ts': {
    'agent-property': {
      count: 2,
      reason: "permanent: xterm's theme key `cursor` is the caret's colour, not the agent",
    },
  },
  'src/shared/workspace.ts': {
    'agent-literal': { count: 6, reason: 'moved in P0.7' },
  },
}

/**
 * @typedef {{ file: string, line: number, rule: string, message: string }} Violation
 * @typedef {{ ids: readonly string[], commands: Readonly<Record<string, string>> }} Roster
 */

/** @param {string} file @returns {ts.SourceFile} */
const parse = (file) =>
  ts.createSourceFile(
    file,
    readFileSync(join(ROOT, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )

/**
 * The agents as the tree declares them: `AGENT_IDS` in the ids module, and each one's command in its
 * descriptor.
 * @returns {Roster}
 */
export function readRoster() {
  /** @type {string[]} */
  const ids = []
  const visit = (/** @type {ts.Node} */ node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'AGENT_IDS' &&
      node.initializer
    ) {
      let list = node.initializer
      while (ts.isAsExpression(list) || ts.isSatisfiesExpression(list)) list = list.expression
      if (ts.isArrayLiteralExpression(list))
        for (const element of list.elements)
          if (ts.isStringLiteralLike(element)) ids.push(element.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(parse(IDS))
  /** @type {Record<string, string>} */
  const commands = {}
  for (const id of ids) {
    const find = (/** @type {ts.Node} */ node) => {
      if (
        ts.isPropertyAssignment(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === 'command' &&
        ts.isStringLiteralLike(node.initializer)
      )
        commands[id] = node.initializer.text
      ts.forEachChild(node, find)
    }
    find(parse(`${AGENTS_CORE}/${id}/descriptor.ts`))
  }
  return { ids, commands }
}

/** @param {string} name */
const wordsOf = (name) =>
  (name.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+/g) ?? []).map((word) => word.toLowerCase())

/**
 * Which agent folder a path is in, and on which side, or null.
 * @param {string} path relative to the root, with or without its extension
 * @param {Roster} roster
 */
function agentFolderOf(path, roster) {
  const parts = path.split('/')
  if (parts.length < 4 || parts[0] !== 'src' || parts[2] !== 'agents') return null
  if (parts[1] !== 'core' && parts[1] !== 'main') return null
  const folder = parts[3] ?? ''
  const isFolder = roster.ids.includes(folder) || folder === 'shared' || parts.length >= 5
  return isFolder ? { side: parts[1], folder } : null
}

/**
 * @param {string} file path relative to the repository root, with forward slashes
 * @param {string} source
 * @param {Roster} [roster]
 * @returns {Violation[]}
 */
export function findViolations(file, source, roster = readRoster()) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const lines = source.split('\n')
  const inCore = file.startsWith('src/core/')
  const readsTime = file !== CLOCK && (file.startsWith('src/') || file.startsWith('tests/'))
  /** @type {Violation[]} */
  const found = []

  /** @param {ts.Node} node @param {string} rule @param {string} message */
  const report = (node, rule, message) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    found.push({ file, line: line + 1, rule, message })
  }

  /** @param {ts.Node} node */
  const isDate = (node) => {
    const inner =
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'globalThis'
        ? node.name
        : node
    return ts.isIdentifier(inner) && inner.text === 'Date'
  }

  const own = agentFolderOf(file, roster)
  const inTests = file.startsWith('tests/') || file.startsWith('e2e/')
  const namesAllowed = new Set(
    inTests || file === IDS || file === DESCRIPTORS || REGISTRIES.includes(file)
      ? [...roster.ids, ...Object.values(roster.commands)]
      : own && roster.ids.includes(own.folder)
        ? [own.folder, roster.commands[own.folder] ?? own.folder]
        : [],
  )
  const ids = new Set(roster.ids.filter((id) => !namesAllowed.has(id)))
  const names = new Set(
    [...roster.ids, ...Object.values(roster.commands)].filter((name) => !namesAllowed.has(name)),
  )
  const isDescriptor =
    file === DESCRIPTORS || /^src\/core\/agents\/[^/]+\/descriptor\.ts$/.test(file)
  const readsNoKit = file.startsWith('src/renderer/') || file === 'src/core/control/server.ts'
  const defaultsAllowed = file === IDS || REGISTRIES.includes(file)

  /** @param {ts.Node} node @param {string} target */
  const checkAgentImport = (node, target) => {
    const typeOnly = ts.isImportDeclaration(node) && node.importClause?.isTypeOnly === true
    const into = agentFolderOf(target, roster)
    const bare = target.replace(/\.(ts|mts|cts|js|mjs)$/, '').replace(/\/index$/, '')
    if (into && into.folder !== 'shared' && !inTests) {
      const fromRegistry = file === `src/${into.side}/agents/registry.ts`
      const fromDescriptors =
        file === DESCRIPTORS && bare === `${AGENTS_CORE}/${into.folder}/descriptor`
      const fromOwn = own !== null && own.folder === into.folder
      if (!fromRegistry && !fromDescriptors && !fromOwn)
        report(node, 'agent-import', `${into.folder}'s folder imported outside its registry`)
    }
    if (isDescriptor && !typeOnly) {
      const descriptorFile = /^src\/core\/agents\/[^/]+\/descriptor$/.test(bare)
      if (!descriptorFile && bare !== `${AGENTS_CORE}/ids`)
        report(node, 'descriptors-node-free', `a descriptor imports '${target}'`)
    }
    if (readsNoKit && !typeOnly) {
      const isRegistry = REGISTRIES.some((registry) => bare === registry.replace(/\.ts$/, ''))
      const isKit = into !== null && !/\/descriptor$/.test(bare)
      if (isRegistry || isKit)
        report(
          node,
          'descriptors-node-free',
          `'${target}' brings a kit where only descriptors may go`,
        )
    }
  }

  /** @param {ts.Node} node @param {string} specifier */
  const checkImport = (node, specifier) => {
    const target = specifier.startsWith('.') ? posix.join(posix.dirname(file), specifier) : null
    if (target !== null) checkAgentImport(node, target)
    else if (isDescriptor)
      report(node, 'descriptors-node-free', `a descriptor imports '${specifier}'`)
    if (!inCore) return
    if (specifier === 'electron' || specifier.startsWith('electron/')) {
      report(node, 'core-imports-electron', `src/core imports '${specifier}'`)
    } else if (target !== null) {
      if (!target.startsWith('src/core/') && target !== 'src/core') {
        report(node, 'core-imports-outside', `src/core imports '${specifier}', outside src/core`)
      }
    }
  }

  /** @param {ts.Node | undefined} node */
  const isDefaultAgent = (node) => {
    if (!node) return false
    if (ts.isIdentifier(node)) return DEFAULTS.has(node.text)
    return ts.isPropertyAccessExpression(node) && DEFAULTS.has(node.name.text)
  }

  /** @param {ts.Node} node */
  const isNameSlot = (node) =>
    ts.isPropertyAssignment(node) ||
    ts.isPropertySignature(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isEnumMember(node)

  const COMPARISONS = new Set([
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
  ])

  /** @param {ts.Node} node */
  const visitAgents = (node) => {
    const parent = node.parent
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const asName =
        parent &&
        ((isNameSlot(parent) && /** @type {{ name?: ts.Node }} */ (parent).name === node) ||
          (ts.isElementAccessExpression(parent) && parent.argumentExpression === node))
      const isModule =
        parent &&
        (ts.isImportDeclaration(parent) ||
          ts.isExportDeclaration(parent) ||
          ts.isExternalModuleReference(parent) ||
          (ts.isCallExpression(parent) &&
            (parent.expression.kind === ts.SyntaxKind.ImportKeyword ||
              (ts.isIdentifier(parent.expression) && parent.expression.text === 'require'))) ||
          (ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent)))
      if (asName) {
        if (ids.has(node.text)) report(node, 'agent-property', `'${node.text}' used as a key`)
      } else if (!isModule && names.has(node.text)) {
        report(node, 'agent-literal', `the agent '${node.text}' named`)
      }
    }
    if (ts.isIdentifier(node) && parent) {
      if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
        if (ids.has(node.text)) report(node, 'agent-property', `.${node.text} read by name`)
      } else if (isNameSlot(parent) && /** @type {{ name?: ts.Node }} */ (parent).name === node) {
        if (ids.has(node.text)) report(node, 'agent-property', `'${node.text}' used as a key`)
        else if (wordsOf(node.text).some((word) => ids.has(word)))
          report(node, 'agent-identifier', `'${node.text}' is named after an agent`)
      } else if (
        (ts.isVariableDeclaration(parent) ||
          ts.isParameter(parent) ||
          ts.isFunctionDeclaration(parent) ||
          ts.isFunctionExpression(parent) ||
          ts.isClassDeclaration(parent) ||
          ts.isClassExpression(parent) ||
          ts.isInterfaceDeclaration(parent) ||
          ts.isTypeAliasDeclaration(parent) ||
          ts.isEnumDeclaration(parent) ||
          ts.isTypeParameterDeclaration(parent) ||
          ts.isBindingElement(parent)) &&
        /** @type {{ name?: ts.Node }} */ (parent).name === node &&
        wordsOf(node.text).some((word) => ids.has(word))
      ) {
        report(node, 'agent-identifier', `'${node.text}' is named after an agent`)
      }
    }
    if (!defaultsAllowed) {
      if (
        ts.isBinaryExpression(node) &&
        COMPARISONS.has(node.operatorToken.kind) &&
        (isDefaultAgent(node.left) || isDefaultAgent(node.right))
      )
        report(node, 'agent-default', 'compared to the default agent')
      if (ts.isSwitchStatement(node) && isDefaultAgent(node.expression))
        report(node, 'agent-default', 'switched on the default agent')
      if (ts.isCaseClause(node) && isDefaultAgent(node.expression))
        report(node, 'agent-default', 'the default agent as a case')
    }
  }

  /** @param {ts.Node} node */
  const visit = (node) => {
    if (readsTime) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'now' &&
        isDate(node.expression.expression)
      ) {
        report(node, 'time-outside-clock', `Date.now() outside ${CLOCK}`)
      }
      if (
        ts.isNewExpression(node) &&
        isDate(node.expression) &&
        (node.arguments ?? []).length === 0
      ) {
        report(node, 'time-outside-clock', `new Date() outside ${CLOCK}`)
      }
    }
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      checkImport(node, node.moduleSpecifier.text)
    }
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const [arg] = node.arguments
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
      if ((isDynamicImport || isRequire) && arg && ts.isStringLiteralLike(arg))
        checkImport(node, arg.text)
    }
    if (
      file !== LOG &&
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'console'
    ) {
      report(node, 'console-outside-log', `console.${node.name.text} outside ${LOG}`)
    }
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
      const justified = ANY_REASON.test(lines[line] ?? '') || ANY_REASON.test(lines[line - 1] ?? '')
      if (!justified) report(node, 'no-any', '`any` without a line-scoped reason')
    }
    visitAgents(node)
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

/**
 * The hits a file has beyond what `allowed` counts for it. Only the agent rules can be counted.
 * @param {Violation[]} violations
 * @param {Readonly<Record<string, Readonly<Record<string, { count: number }>>>>} allowed
 */
export function overAllowed(violations, allowed) {
  /** @type {Map<string, { file: string, rule: string, count: number }>} */
  const tally = new Map()
  for (const v of violations) {
    const key = `${v.file}\0${v.rule}`
    const entry = tally.get(key) ?? { file: v.file, rule: v.rule, count: 0 }
    entry.count += 1
    tally.set(key, entry)
  }
  return [...tally.values()]
    .map((entry) => ({
      ...entry,
      allowed: AGENT_RULES.has(entry.rule) ? (allowed[entry.file]?.[entry.rule]?.count ?? 0) : 0,
    }))
    .filter((entry) => entry.count > entry.allowed)
}

/** @param {string} dir @returns {string[]} */
function sources(dir) {
  /** @type {string[]} */
  const out = []
  let entries
  try {
    entries = readdirSync(join(ROOT, dir), { withFileTypes: true })
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return out
    throw error
  }
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) out.push(...sources(path))
    else if (/\.(ts|mts|cts)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(path)
  }
  return out
}

function main() {
  const files = ['src', 'tests', 'e2e'].flatMap(sources)
  if (!files.includes(CLOCK)) {
    console.error(`check-code-rules: ${CLOCK} not found; the scan is looking in the wrong place`)
    process.exit(1)
  }
  const roster = readRoster()
  if (roster.ids.length === 0 || roster.ids.some((id) => !roster.commands[id])) {
    console.error(
      `check-code-rules: the agents could not be read from ${IDS} and their descriptors`,
    )
    process.exit(1)
  }
  const violations = files.flatMap((file) =>
    findViolations(file, readFileSync(join(ROOT, file), 'utf8'), roster),
  )
  const over = overAllowed(violations, ALLOWED)
  for (const { file, rule, count, allowed } of over) {
    for (const v of violations.filter((v) => v.file === file && v.rule === rule))
      console.error(`${v.file}:${v.line}: [${v.rule}] ${v.message}`)
    if (allowed > 0) console.error(`  ${file}: ${count} [${rule}] where ALLOWED counts ${allowed}`)
  }
  if (over.length > 0) {
    console.error(`check-code-rules: ${over.length} rule(s) broken in ${files.length} file(s)`)
    process.exit(1)
  }
  console.log(`check-code-rules: ${files.length} file(s) clean`)
}

if (process.argv[1] && relative(process.argv[1], fileURLToPath(import.meta.url)) === '') main()
