import { execSync } from 'node:child_process'
import type { FullConfig } from '@playwright/test'

async function globalSetup(_config: FullConfig) {
  try {
    execSync("pkill -f 'chromium|chrome' || true", { stdio: 'ignore' })
  } catch {
    // Ignore failures from missing processes.
  }
}

export default globalSetup
