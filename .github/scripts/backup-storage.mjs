// Mirrors every Supabase Storage bucket into OUT_DIR/<bucket>/<path>, for the backup workflow.
//
// Incremental: OUT_DIR/manifest.json remembers each file's eTag/updated_at, so only new or changed
// files are downloaded. Files deleted from Storage are deleted here too — the backups repo's git
// history still has every earlier version.
//
// This runs in a PUBLIC repo's Actions log, so it prints counts only, never file names or paths.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OUT_DIR

import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OUT_DIR } = process.env
const missing = Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OUT_DIR }).filter(([, v]) => !v).map(([k]) => k)
if (missing.length) {
  console.error(`Missing: ${missing.join(', ')}. SUPABASE_SERVICE_ROLE_KEY must be a repository secret ` +
    '(Settings → Secrets and variables → Actions → Repository secrets), not an environment, Dependabot or Codespaces secret.')
  process.exit(1)
}

// GitHub rejects files over 100 MB. Anything bigger is listed in the manifest as skipped.
const MAX_BYTES = 95 * 1024 * 1024
const PAGE = 1000
const MANIFEST = join(OUT_DIR, 'manifest.json')
const auth = { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY }

async function api(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1${path}`, {
    ...init,
    headers: { ...auth, ...(init.body ? { 'content-type': 'application/json' } : {}) },
  })
  if (!res.ok) throw new Error(`Storage API ${init.method ?? 'GET'} failed: ${res.status}`)
  return res
}

const encodePath = p => p.split('/').map(encodeURIComponent).join('/')

// Every file under prefix, recursing into folders (listed with id === null).
async function listFiles(bucket, prefix = '') {
  const entries = []
  for (let offset = 0; ; offset += PAGE) {
    const res = await api(`/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST',
      body: JSON.stringify({ prefix, limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } }),
    })
    const page = await res.json()
    entries.push(...page)
    if (page.length < PAGE) break
  }
  const files = []
  for (const e of entries) {
    const path = prefix ? `${prefix}/${e.name}` : e.name
    if (e.id === null) files.push(...(await listFiles(bucket, path)))
    else files.push({ path, size: e.metadata?.size ?? 0, etag: e.metadata?.eTag ?? null, updated_at: e.updated_at ?? null })
  }
  return files
}

async function walk(dir) {
  let names
  try { names = await readdir(dir, { withFileTypes: true }) } catch { return [] }
  const out = []
  for (const d of names) {
    const full = join(dir, d.name)
    if (d.isDirectory()) out.push(...(await walk(full)))
    else out.push(full)
  }
  return out
}

const previous = await readFile(MANIFEST, 'utf8').then(JSON.parse).catch(() => ({ files: {} }))
const manifest = { generated_at: new Date().toISOString(), files: {}, skipped_too_large: {} }
const keep = new Set([MANIFEST])
let downloaded = 0, unchanged = 0, skipped = 0

const buckets = await (await api('/bucket')).json()
for (const bucket of buckets) {
  for (const f of await listFiles(bucket.id)) {
    const key = `${bucket.id}/${f.path}`
    if (key.split('/').some(s => s === '..' || s === '')) throw new Error('Refusing a storage path with an empty or ".." segment')
    const meta = { size: f.size, etag: f.etag, updated_at: f.updated_at }

    if (f.size > MAX_BYTES) {
      manifest.skipped_too_large[key] = meta
      skipped++
      continue
    }

    const local = join(OUT_DIR, ...key.split('/'))
    keep.add(local)
    manifest.files[key] = meta

    const before = previous.files?.[key]
    const same = before && before.etag === meta.etag && before.updated_at === meta.updated_at && before.size === meta.size
    if (same && (await readFile(local).then(() => true, () => false))) {
      unchanged++
      continue
    }

    const res = await api(`/object/${encodeURIComponent(bucket.id)}/${encodePath(f.path)}`)
    await mkdir(dirname(local), { recursive: true })
    await writeFile(local, Buffer.from(await res.arrayBuffer()))
    downloaded++
  }
}

let removed = 0
for (const file of await walk(OUT_DIR)) {
  if (!keep.has(file) && !relative(OUT_DIR, file).startsWith('..' + sep)) {
    await rm(file)
    removed++
  }
}

await mkdir(OUT_DIR, { recursive: true })
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Storage: ${buckets.length} buckets, ${downloaded} downloaded, ${unchanged} unchanged, ${removed} removed, ${skipped} too large to store`)
if (skipped) console.log('::warning::Some storage files are over 95 MB and were not backed up — see storage/manifest.json')
