-- -- Enable Realtime
-- drop publication if exists supabase_realtime;
-- create publication supabase_realtime for all tables;

-- Games Table
create table public.real_vs_ai_games (
  id text primary key, -- 4 letter code
  status text not null default 'waiting', -- waiting, playing, finished
  settings jsonb not null default '{}', -- rounds, time_limit, etc
  current_round int not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Players Table
create table public.real_vs_ai_players (
  id uuid primary key default gen_random_uuid(),
  game_id text references public.real_vs_ai_games(id) on delete cascade,
  name text not null,
  emoji text not null,
  score int not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Rounds Table
create table public.real_vs_ai_rounds (
  id uuid primary key default gen_random_uuid(),
  game_id text references public.real_vs_ai_games(id) on delete cascade,
  round_number int not null,
  real_image_url text not null,
  ai_image_url text not null,
  correct_option text not null, -- 'real' or 'ai' (or image id if multiple)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Votes Table
create table public.real_vs_ai_votes (
  id uuid primary key default gen_random_uuid(),
  game_id text references public.real_vs_ai_games(id) on delete cascade,
  round_id uuid references public.real_vs_ai_rounds(id) on delete cascade,
  player_id uuid references public.real_vs_ai_players(id) on delete cascade,
  choice text not null,
  is_correct boolean,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) - Optional for prototype but good practice
alter table public.real_vs_ai_games enable row level security;
alter table public.real_vs_ai_players enable row level security;
alter table public.real_vs_ai_rounds enable row level security;
alter table public.real_vs_ai_votes enable row level security;

-- Allow public access for this game (since we have no auth)
create policy "Public access for games" on public.real_vs_ai_games for all using (true) with check (true);
create policy "Public access for players" on public.real_vs_ai_players for all using (true) with check (true);
create policy "Public access for rounds" on public.real_vs_ai_rounds for all using (true) with check (true);
create policy "Public access for votes" on public.real_vs_ai_votes for all using (true) with check (true);
