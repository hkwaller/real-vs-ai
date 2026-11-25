import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const production = process.env.VERCEL_ENV === 'production'
const cwd = fileURLToPath(new URL('../', import.meta.url))

function run(script) {
  const result = spawnSync('npm', ['run', script], { cwd, stdio: 'inherit' })
  if (result.error) console.error(result.error.message)
  if (result.error || result.status !== 0) process.exit(result.status || 1)
}

if (production) {
  const missing = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'].filter((key) => !process.env[key]?.trim())
  if (missing.length) {
    console.error(`Missing production deployment variables: ${missing.join(', ')}. Add them to this project's Vercel Production environment.`)
    process.exit(1)
  }
  run('party:check')
}

run('build')

if (production) {
  console.log('Deploying the production Party worker to Cloudflare.')
  run('party:deploy')
} else {
  console.log('Skipping Party worker deployment outside Vercel production.')
}
