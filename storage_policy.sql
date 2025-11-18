-- Allow public access to list files in the 'real-vs-ai' bucket
-- This is required for the game to find images to display
create policy "Allow public listing of real-vs-ai bucket"
on storage.objects for select
to public
using ( bucket_id = 'real-vs-ai' );
