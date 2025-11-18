-- Function to increment player score safely
create or replace function real_vs_ai_increment_score(row_id uuid, amount int)
returns void as $$
begin
  update public.real_vs_ai_players
  set score = score + amount
  where id = row_id;
end;
$$ language plpgsql;
