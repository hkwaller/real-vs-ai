# Storage lockdown: remaining steps

The `real-vs-ai` bucket (Supabase project `ish`, `bpjsvmcfqpcmmdgilxzu`) still has the old open policies live. Anyone with the public anon key can list, upload, overwrite and delete images and `challenges/schedule.json`. The code side is done. What's left is below, **in this order**. Dropping the policies before production runs the new code breaks the production admin page.

## Already done (in the working tree, not deployed)

- `api/admin-storage.js` checks the Clerk session, requires `publicMetadata.role === 'admin'`, and uses the service-role key to sign uploads (`sign-upload`) and delete files (`remove`). Paths are limited to `real/<name>`, `ai/<name>` and `challenges/schedule.json`.
- `src/lib/adminStorage.ts` is the client side. AdminView (AI upload, replace, missing-slot upload, delete) and `saveSchedule` use it. AdminView shows "admins only" to non-admins.
- `storage_policy.sql` keeps public reads and drops the three write policies.
- The `vercel.json` SPA rewrite now skips `/api/`, `/@…` and paths with file extensions, so `npm run dev:api` works.
- `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel **Development**.
- Your Clerk **dev** user has `{"role":"admin"}`.

## When n8n is back up

1. **Check which Supabase key n8n uses.** The "Send to n8n" step posts the real image to the n8n webhook, which then uploads `real/<name>.jpg` itself. In n8n, open the Supabase/HTTP node that does that upload:
   - **service_role key:** nothing to do. It bypasses RLS.
   - **anon key:** switch it to the service_role key (stored as an n8n credential, never in the app). Otherwise real-image uploads fail once the policies are dropped.
2. **Run the whole admin flow locally** with `npm run dev:api`: send to n8n, upload the AI image (it gets assigned to a date automatically), replace an AI image, upload a missing slot, delete a pair, and save and delete a daily challenge. Watch the dev server for `admin-storage:` lines.
3. **Check the n8n webhook key.** The app sends `VITE_API_KEY` as `real-vs-ai-key`. Under `vercel dev`, the Vercel Development value overrides `.env.local`. A mismatch gives a 403 `Authorization data is wrong!` and no execution appears in n8n. Also `.env.local` now points at the production webhook (`/webhook/…`). Use `/webhook-test/…` only while clicking "Execute workflow" in n8n.

## Going live

4. **Production env (Vercel):**
   - Add the service-role key: `npx vercel env add SUPABASE_SERVICE_ROLE_KEY production` (and `preview` if you use previews).
   - Check `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` belong to the same Clerk instance.
   - Check `VITE_N8N_API_URL` is set for production. It's currently missing from the Vercel env list.
5. **Set the admin role on your production Clerk user.** In the Clerk dashboard, on the production instance, go to Users → you → Public metadata and add `{"role": "admin"}`. Dev and prod instances have separate users.
6. **Deploy**, then on production check that `/admin` loads and that an upload and a schedule save work. This works even with the old policies still in place, because the service-role key bypasses RLS.
7. **Drop the open write policies** on the live project. This is the bottom half of `storage_policy.sql`:

   ```sql
   drop policy if exists "Allow public uploading to real-vs-ai bucket" on storage.objects;
   drop policy if exists "Allow public updating in real-vs-ai bucket" on storage.objects;
   drop policy if exists "Allow public deleting in real-vs-ai bucket" on storage.objects;
   ```

8. **Verify:**
   - `select policyname, cmd from pg_policies where schemaname = 'storage' and policyname ilike '%real-vs-ai%';` should show only the SELECT policy.
   - An anon upload should fail (for example, the old `supabase.storage.from('real-vs-ai').upload(...)` from the browser console).
   - The game, the daily challenge and the admin flow should still work.
   - The n8n real-image upload should still land in `real/`.

## Why not Clerk-issued Supabase tokens

The `ish` project is shared with other apps. Its `order-files` bucket gives `authenticated` full access, and `gallery` lets `authenticated` insert and delete. Connecting Clerk as a Supabase auth provider would make every signed-in player `authenticated`, with write access to those buckets. Do not add `authenticated` write policies for `real-vs-ai`.

## Related, not done

- **Players can work out the answer.** It isn't just `isRealLeft`: the round image URLs in Liveblocks storage contain `/real/` and `/ai/`, and any player can read them with the public key. The daily challenge leaks the same way through `schedule.json` and its URLs. A real fix needs neutral file names or an image proxy, with the real/AI mapping kept on the host or a server.
- **The n8n webhook key ships in the browser bundle** (`VITE_API_KEY`), so anyone can trigger the image pipeline. To fix it, put the n8n call behind an `api/` route that checks for an admin.
- **Other buckets in `ish` allow anon inserts** (`avatars`, `images`, `designs`, `spelling-bee-audio`). They belong to other apps and haven't been touched.
- **Remove the temporary logging** in `api/admin-storage.js` (`admin-storage:` warnings) once everything is stable, or keep it if it's useful.
