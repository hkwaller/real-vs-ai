-- Library replacement drafts preserve old JPEG, PNG and WebP bytes.
update storage.buckets
set file_size_limit = greatest(file_size_limit, 16777216),
    allowed_mime_types = case when allowed_mime_types is null then null else array(
      select distinct unnest(allowed_mime_types || array['image/png', 'image/webp'])
    ) end
where id = 'real-vs-ai-drafts';
