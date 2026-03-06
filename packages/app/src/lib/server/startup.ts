/**
 * Called once when the server process starts.
 * Validates configuration and logs the storage layout so operators
 * can confirm the correct PersistentVolumeClaim is mounted.
 */
import { logStorageConfig } from './storage.js'
import { getDb } from './db/index.js'

let initialised = false

export function ensureStarted(): void {
  if (initialised) return
  initialised = true
  logStorageConfig()
  // Open the database connection and run migrations eagerly at startup
  // rather than on first request, so failures surface immediately.
  getDb()
}
