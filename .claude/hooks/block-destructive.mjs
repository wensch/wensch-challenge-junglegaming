// PreToolUse(Bash): denies destructive or out-of-project commands.
import path from 'node:path'
const win = (p) => String(p ?? '').replace(/^\/([a-zA-Z])(\/|$)/, '$1:/')
let raw = ''
for await (const c of process.stdin) raw += c
const input = JSON.parse(raw || '{}')
const cmd = String(input.tool_input?.command ?? '')
const project = path.resolve(win(process.env.CLAUDE_PROJECT_DIR ?? process.cwd())).toLowerCase()

const rules = [
  [/\bgit\s+push\b[^\n]*(--force\b|-f\b|--force-with-lease)/, 'force push'],
  [/\bgit\s+reset\s+--hard\b/, 'git reset --hard'],
  [/\bgit\s+clean\s+-[a-z]*f/, 'git clean -f'],
  [/\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, 'discarding all working-tree changes'],
  [/\bgit\s+branch\s+-D\b/, 'force branch delete'],
  [/\b(gh\s+repo\s+delete|vercel\s+(rm|remove)\b)/, 'deleting remote resources'],
  [/\bRemove-Item\b[^\n]*-Recurse/i, 'recursive Remove-Item'],
  [/\b(format|mkfs|diskpart|shutdown|reg\s+delete)\b/i, 'system-level command'],
  [/\bnpm\s+publish\b/, 'npm publish'],
]
for (const [re, why] of rules) if (re.test(cmd)) deny(`Blocked by project hook: ${why}.`)

// rm -r / rm -rf only for paths inside the project.
const rm = cmd.match(/\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+([^;&|\n]+)/)
if (rm) {
  for (const t of rm[1].trim().split(/\s+/)) {
    if (t.startsWith('-')) continue
    const p = t.replace(/^~(?=\/|$)/, process.env.HOME ?? process.env.USERPROFILE ?? '~').replace(/^["']|["']$/g, '')
    if (p === '/' || p === '~' || p === '*' || p.includes('..')) deny(`Blocked: rm -r on "${t}".`)
    const abs = path.resolve(win(input.cwd ?? process.cwd()), win(p)).toLowerCase()
    if (!abs.startsWith(project)) deny(`Blocked: rm -r outside the project (${t}).`)
  }
}
process.exit(0)

function deny(reason) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }))
  process.exit(0)
}
