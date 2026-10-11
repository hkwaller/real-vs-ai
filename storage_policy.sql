-- Storage policies for the 'real-vs-ai' bucket.
--
-- Anyone may list and read (the game lists real/ to find image pairs and loads
-- them by public URL). There are deliberately NO insert/update/delete policies:
-- writes go through api/admin-storage.js, which checks the caller is a Clerk
-- admin and uses the service-role key (bypasses RLS). Do not add 'authenticated'
-- write policies here - this Supabase project is shared with other apps.

create policy "Allow public listing of real-vs-ai bucket"
on storage.objects for select
to public
using ( bucket_id = 'real-vs-ai' );

-- Migration from the old open-write policies:
drop policy if exists "Allow public uploading to real-vs-ai bucket" on storage.objects;
drop policy if exists "Allow public updating in real-vs-ai bucket" on storage.objects;
drop policy if exists "Allow public deleting in real-vs-ai bucket" on storage.objects;
