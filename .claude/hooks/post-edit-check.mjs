// PostToolUse(Edit|Write): lint the edited TS file and typecheck the project; feed errors back to Claude.
import { execSync } from 'node:child_process'
import path from 'node:path'
let raw = ''
for await (const c of process.stdin) raw += c
const input = JSON.parse(raw || '{}')
const file = String(input.tool_input?.file_path ?? '')
if (!/\.(ts|tsx)$/.test(file) || file.includes('node_modules')) process.exit(0)
const project = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
const run = (cmd) => { try { execSync(cmd, { cwd: project, stdio: 'pipe', timeout: 90_000 }); return '' } catch (e) { return String(e.stdout || '') + String(e.stderr || '') } }
const lint = run(`npx eslint --no-warn-ignored "${path.resolve(project, file)}"`)
const tsc = run('npx tsc -b --noEmit --pretty false')
const out = [lint && `ESLint:\n${lint.slice(0, 3000)}`, tsc && `tsc:\n${tsc.slice(0, 3000)}`].filter(Boolean).join('\n\n')
if (out) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `Checks failed after editing ${file}:\n${out}` } }))
