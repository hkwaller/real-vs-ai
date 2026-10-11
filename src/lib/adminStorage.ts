import { supabase } from './supabase'

// Client side of api/admin-storage.js. The bucket only allows public reads, so
// writes ask the API (Clerk admin check + service-role key) for a signed upload
// token, then upload straight to Storage with it.

const BUCKET = 'real-vs-ai'

export type GetToken = () => Promise<string | null>

type UploadOptions = { contentType?: string; cacheControl?: string }

async function callAdminApi(getToken: GetToken, body: Record<string, unknown>) {
  const token = await getToken()
  if (!token) throw new Error('No Clerk session token - are you signed in?')
  const res = await fetch('/api/admin-storage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `Admin storage request failed (${res.status})`)
  return json
}

export async function adminUpload(
  getToken: GetToken,
  path: string,
  file: Blob,
  options: UploadOptions = {},
): Promise<void> {
  const { token } = await callAdminApi(getToken, { action: 'sign-upload', path })
  // Plain `vite` has no /api and answers with index.html, so there's no token.
  if (!token) throw new Error('No upload token from /api/admin-storage - run `npm run dev:api`')
  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(path, token, file, options)
  if (error) throw error
}

export async function adminRemove(getToken: GetToken, paths: string[]): Promise<void> {
  await callAdminApi(getToken, { action: 'remove', paths })
}
