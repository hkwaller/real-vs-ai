# Image pair pipeline

The admin dashboard creates a draft in Supabase and calls a separate n8n worker. The worker acknowledges the request immediately, sends the source photo to OpenAI as a reference and uploads the 1024×1024 JPEG to private storage. The admin can review, regenerate, skip or approve the draft. Approval adds the pair to the game library, where it becomes eligible for automatic daily challenges. You can also assign pairs to specific dates in **Daily Challenges**.

Apply [the daily challenge migration](../supabase/migrations/20261126090100_daily_challenges.sql) before deploying the schedule API. The first schedule request imports the existing `challenges/schedule.json` from Storage. On the first player request for an unscheduled day, the API saves one complete pair that has never been used or reserved for another date. If no unused pair is available, the game retries on a later request.

## Set up the worker and app

1. Apply [the draft migration](../supabase/migrations/20261125000000_image_pair_drafts.sql) in the Supabase project used by the target app environment. It creates the private `real-vs-ai-drafts` bucket and service-role-only metadata table.
2. Import [Real vs AI | Generate image pair](../n8n/real-vs-ai-image-pairs.json) into n8n as a new workflow. In **Accept pair job**, select a Header Auth credential with the name `X-Image-Worker-Key` and a new random secret as its value. In **Generate counterpart**, select the existing OpenAI API credential. Save and publish the new workflow to register its production webhook.
3. Set the app's server environment variables. `SUPABASE_SERVICE_ROLE_KEY` must match the project from step 1. `IMAGE_PAIR_N8N_WEBHOOK_URL` is the new production webhook URL. `IMAGE_PAIR_N8N_WEBHOOK_SECRET` is the Header Auth credential value. For local testing, put the keys in `.env.local`, start `npm run dev`, and open `/admin`. The API endpoint itself expects an authenticated POST. For Vercel local emulation, use `npm run dev:api`. The n8n worker receives expiring URLs for specific files and uses its OpenAI credential. It needs no Supabase credential.
4. Test in `/admin` with a photo you own. Check that it reaches **Ready for review**, that both panels display, and that **Approve** adds it to **Existing Images**. Use **Regenerate** on a separate draft to verify a new output can replace the previous one. Check that the resulting pair can be added to a Daily Challenge.
5. Remove the old `VITE_N8N_API_URL` and `VITE_API_KEY` from this app's deployment settings. The old webhook key was bundled in the app. Rotate it in the old workflow and any services that still call it.

The worker records failures in private storage. The workflow editor can run just the webhook step. To test generation, submit a draft in the app with the published production webhook URL and inspect the full execution in n8n. If the worker rejects the key, verify the published trigger uses the matching Header Auth credential and restart the local dev server after changing `.env.local`. A job with no result is eligible for regeneration after ten minutes. If publishing is interrupted, **Retry publish** becomes available after the publishing request has expired.

## Unsplash

Set `UNSPLASH_ACCESS_KEY` to enable the admin catalog. It searches by category and filters for free photos uploaded before 2021. Upload date is a provenance signal and the admin can open the source page while reviewing. The picker preserves direct Unsplash thumbnails and includes photographer credit. When import is enabled, choose a specific result or use **Generate from category** to pick an eligible unused photo automatically.

Set `UNSPLASH_PAIR_IMPORT_ENABLED=true` only after Unsplash confirms this integration may send API-sourced images to OpenAI for reference generation, host the originals in Supabase and display them in the game's current presentation. Keep browsing enabled independently. The import records the original photo ID and source page, photographer, upload date and search category. The game currently has no player-facing source credits, so add the agreed credit placement before enabling import if Unsplash requires it.

- [Unsplash API terms](https://unsplash.com/api-terms)
- [Unsplash API display and download rules](https://unsplash.com/documentation#guidelines--crediting)
- [OpenAI image edit API](https://developers.openai.com/api/reference/resources/images/methods/edit)

## Use ChatGPT Images without API credits

In **Draft pairs**, choose **ChatGPT Images**. Save an original from your own photo upload or from the enabled Unsplash catalog. The app stores the original without calling n8n.

Open **Use ChatGPT Images** on the draft, download the original, and copy the prompt. Attach the original and paste the prompt in [ChatGPT Images](https://chatgpt.com/images). Save the generated image and choose **Upload AI counterpart** on the same draft. Review both images and click **Approve** when the pair is ready.

Drafts with a saved original from a failed n8n run can use the same upload control. Choose **n8n (API)** when you want to use automated generation again.

## Prepare a batch in Codex

In a local Codex chat for this project, ask something like “Prepare three wildlife pairs for review.” Codex uses the workspace’s configured Supabase credentials and its built-in image tool. The script uses Apple's `sips` to save JPEGs with the original aspect ratio and a 1024-pixel long edge.

1. Run `node --env-file=.env.local scripts/codex-image-pairs.mjs prepare --count 3 --category Wildlife`. Use the requested count and category. Omit the category to use existing drafts with saved originals, or pass `--draft UUID` to work on one specific draft. The command reuses eligible drafts first and can source more photos from Unsplash when import is enabled. If it returns fewer originals, process those and report the shortfall.
2. Inspect every reference listed in the returned manifest using the local image viewer. Write a brief JSON file for each reference with two strings, `description` and `direction`. Describe the visible subject, surroundings, framing, perspective, light, color, and textures in `description`. In `direction`, say which visual traits to preserve and which incidental details to vary. Base the brief on the image itself.
3. Use the built-in image generation tool with the original and the scene-specific brief. Ask for a new photorealistic image with the original aspect ratio with matching visual composition and small, plausible differences. Inspect the result side by side before staging. If the built-in tool is unavailable, report the blocker and leave the original draft available for manual upload.
4. Run `node --env-file=.env.local scripts/codex-image-pairs.mjs stage --draft UUID --manifest PATH --image PATH --brief PATH` with the matching paths for each pair. The script stages the counterpart and its brief together. The pair and **Image analysis** appear in **Admin → Draft pairs**. The admin approves the result in the dashboard.

## Refresh existing library pairs in Codex

For an older-library refresh, run `node --env-file=.env.local scripts/codex-image-pairs.mjs prepare --count 5 --before 2026-11-01`. The cutoff applies to the current AI file's modification date. The command uses paired library JPEGs, starts with the oldest, and reuses unfinished drafts. Follow the same analysis, image generation, and `stage` steps above for each reference. Keep batches small enough to review in the draft queue.

Each replacement draft shows the original, current AI image, and proposed AI image. **Approve replacement** replaces the existing AI file under its current name and keeps the previous file in the private draft bucket. Approval checks that the library pair still matches the draft. Past Daily Challenges that reference the same filename will use the approved replacement.
