# Image pair pipeline

The admin dashboard creates a draft in Supabase and calls a separate n8n worker. The worker acknowledges the request immediately, sends the source photo to OpenAI as a reference and uploads the 1024×1024 JPEG to private storage. The admin can review, regenerate, skip or approve the draft. Approval adds the pair to the game library. Assign it to a date in **Daily Challenges** when it is ready for the daily game.

## Set up the worker and app

1. Apply [the draft migration](../supabase/migrations/20261125000000_image_pair_drafts.sql) in the Supabase project used by the target app environment. It creates the private `real-vs-ai-drafts` bucket and service-role-only metadata table.
2. Import [Real vs AI | Generate image pair](../n8n/real-vs-ai-image-pairs.json) into n8n as a new workflow. In **Accept pair job**, select a Header Auth credential with the name `X-Image-Worker-Key` and a new random secret as its value. In **Generate counterpart**, select the existing OpenAI API credential. Save and publish the new workflow to register its production webhook.
3. Set the app's server environment variables. `SUPABASE_SERVICE_ROLE_KEY` must match the project from step 1. `IMAGE_PAIR_N8N_WEBHOOK_URL` is the new production webhook URL. `IMAGE_PAIR_N8N_WEBHOOK_SECRET` is the Header Auth credential value. Deploy the app or run `npm run dev:api` with the development values. The n8n worker receives expiring URLs for specific files and uses its OpenAI credential. It needs no Supabase credential.
4. Test in `/admin` with a photo you own. Check that it reaches **Ready for review**, that both panels display, and that **Approve** adds it to **Existing Images**. Use **Regenerate** on a separate draft to verify a new output can replace the previous one. Check that the resulting pair can be added to a Daily Challenge.
5. Remove the old `VITE_N8N_API_URL` and `VITE_API_KEY` from this app's deployment settings. The old webhook key was bundled in the app. Rotate it in the old workflow and any services that still call it.

The worker records failures in private storage. Check n8n and Vercel logs if jobs fail or fail to acknowledge. A job with no result is eligible for regeneration after ten minutes. If publishing is interrupted, **Retry publish** becomes available after the publishing request has expired.

## Unsplash

Set `UNSPLASH_ACCESS_KEY` to enable the admin catalog. It searches by category and filters for free photos uploaded before 2021. Upload date is a provenance signal and the admin can open the source page while reviewing. The picker preserves direct Unsplash thumbnails and includes photographer credit. When import is enabled, choose a specific result or use **Generate from category** to pick an eligible unused photo automatically.

Set `UNSPLASH_PAIR_IMPORT_ENABLED=true` only after Unsplash confirms this integration may send API-sourced images to OpenAI for reference generation, host the originals in Supabase and display them in the game's current presentation. Keep browsing enabled independently. The import records the original photo ID and source page, photographer, upload date and search category. The game currently has no player-facing source credits, so add the agreed credit placement before enabling import if Unsplash requires it.

- [Unsplash API terms](https://unsplash.com/api-terms)
- [Unsplash API display and download rules](https://unsplash.com/documentation#guidelines--crediting)
- [OpenAI image edit API](https://developers.openai.com/api/reference/resources/images/methods/edit)
