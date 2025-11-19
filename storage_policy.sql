-- Allow public access to list files in the 'real-vs-ai' bucket
-- This is required for the game to find images to display
create policy "Allow public listing of real-vs-ai bucket"
on storage.objects for select
to public
using ( bucket_id = 'real-vs-ai' );

-- Allow public access to upload files to the 'real-vs-ai' bucket
create policy "Allow public uploading to real-vs-ai bucket"
on storage.objects for insert
to public
with check ( bucket_id = 'real-vs-ai' );

-- Allow public access to delete files in the 'real-vs-ai' bucket
create policy "Allow public deleting in real-vs-ai bucket"
on storage.objects for delete
to public
using ( bucket_id = 'real-vs-ai' );
