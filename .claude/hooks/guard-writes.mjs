// PreToolUse(Edit|Write|NotebookEdit): audit agents may only write to their allowed folders.
import path from 'node:path'
const win = (p) => String(p ?? '').replace(/^\/([a-zA-Z])(\/|$)/, '$1:/')
let raw = ''
for await (const c of process.stdin) raw += c
const input = JSON.parse(raw || '{}')
const agent = input.agent_type ?? input.agent_name ?? ''
const allowed = {
  'fidelidade-visual': ['reports/'],
  seguranca: ['reports/'],
  'revisor-frontend-senior': ['reports/'],
  'auditor-requisitos': ['reports/', 'docs/requirements-matrix.md'],
  'a11y-performance': ['reports/', 'lighthouse/'],
  'qa-features': ['reports/', 'tests/', 'BUGS.md', 'playwright.config.ts'],
}[agent]
if (!allowed) process.exit(0)
const project = path.resolve(win(process.env.CLAUDE_PROJECT_DIR ?? process.cwd()))
const file = path.resolve(win(input.cwd) || project, String(input.tool_input?.file_path ?? ''))
const rel = path.relative(project, file).split(path.sep).join('/')
if (!rel.startsWith('..') && allowed.some((a) => rel === a || rel.startsWith(a))) process.exit(0)
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `${agent} may only write to: ${allowed.join(', ')} (tried ${rel}).` } }))
