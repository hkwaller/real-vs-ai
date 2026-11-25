begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('real-vs-ai-drafts', 'real-vs-ai-drafts', false, 4194304, array['image/jpeg', 'application/json'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.real_vs_ai_image_drafts (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('upload', 'unsplash')),
  source_id text unique,
  source_url text,
  photographer text,
  photographer_url text,
  source_date date,
  category text,
  status text not null default 'awaiting_source' check (
    status in ('awaiting_source', 'generating', 'failed', 'review', 'publishing', 'published', 'skipped')
  ),
  attempt_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.real_vs_ai_image_drafts enable row level security;
revoke all on public.real_vs_ai_image_drafts from anon, authenticated;
grant select, insert, update on public.real_vs_ai_image_drafts to service_role;

commit;
