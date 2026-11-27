begin;

-- The legacy challenges/schedule.json import is done and the file is gone.
-- Replace the function without p_legacy, and add a 'pool' action that counts
-- the complete pairs that have never been used or scheduled.
-- Callers that pass only p_action, p_day and p_images keep working.
drop function public.real_vs_ai_daily_schedule(text, date, text[], jsonb);

create function public.real_vs_ai_daily_schedule(
  p_action text,
  p_day date default null,
  p_images text[] default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  earliest_today date := ((now() at time zone 'UTC') - interval '12 hours')::date;
  latest_today date := ((now() at time zone 'UTC') + interval '14 hours')::date;
  selected_image text;
begin
  if p_action not in ('read', 'fill', 'save', 'delete', 'pool') then
    raise sqlstate 'PT400' using message = 'Invalid schedule action';
  end if;

  if p_action = 'pool' then
    return jsonb_build_object('remaining', (
      select count(*)
      from storage.objects real
      join storage.objects ai on ai.bucket_id = real.bucket_id
        and ai.name = 'ai/' || substr(real.name, 6)
      where real.bucket_id = 'real-vs-ai' and real.name ~ '^real/[^./][^/]*$'
        and not exists (
          select 1 from public.real_vs_ai_daily_challenges day
          where substr(real.name, 6) = any(day.images) or substr(real.name, 6) = any(day.used_images)
        )
    ));
  end if;

  -- A player can request today's challenge in their local time zone.
  -- Existing entries, including deleted dates, never need to be filled again.
  if p_action = 'fill' and (
    p_day not between earliest_today and latest_today or exists (
      select 1 from public.real_vs_ai_daily_challenges where day = p_day
    )
  ) then
    p_action := 'read';
  end if;

  if p_action <> 'read' then
    -- Serialize selection and manual changes across app instances.
    perform pg_advisory_xact_lock(19940617, 1);

    if p_action = 'fill' and not exists (
      select 1 from public.real_vs_ai_daily_challenges where day = p_day
    ) then
      select substr(real.name, 6) into selected_image
      from storage.objects real
      join storage.objects ai on ai.bucket_id = real.bucket_id
        and ai.name = 'ai/' || substr(real.name, 6)
      where real.bucket_id = 'real-vs-ai' and real.name ~ '^real/[^./][^/]*$'
        and not exists (
          select 1 from public.real_vs_ai_daily_challenges day
          where substr(real.name, 6) = any(day.images) or substr(real.name, 6) = any(day.used_images)
        )
      order by random()
      limit 1;

      if selected_image is not null then
        insert into public.real_vs_ai_daily_challenges (day, images, used_images)
        values (p_day, array[selected_image], array[selected_image]);
      end if;
    elsif p_action = 'save' then
      if coalesce(cardinality(p_images), 0) <> 1 or p_images[1] is null then
        raise sqlstate 'PT400' using message = 'Select one image pair.';
      end if;

      if exists (
        select 1 from public.real_vs_ai_daily_challenges
        where day <> p_day and (images && p_images or used_images && p_images)
      ) then
        raise sqlstate 'PT409' using message = 'A selected pair has already been used or scheduled on another day.';
      end if;

      if (select count(*) from storage.objects where bucket_id = 'real-vs-ai'
        and name in ('real/' || p_images[1], 'ai/' || p_images[1])
      ) <> 2 then
        raise sqlstate 'PT400' using message = 'The pair must have both a real and an AI image.';
      end if;

      insert into public.real_vs_ai_daily_challenges as challenge (day, images)
      values (p_day, p_images)
      on conflict (day) do update set
        images = excluded.images,
        used_images = case when p_day <= latest_today then
          array(select distinct unnest(challenge.used_images || challenge.images))
        else challenge.used_images end;
    elsif p_action = 'delete' then
      update public.real_vs_ai_daily_challenges set
        used_images = case when p_day <= latest_today then
          array(select distinct unnest(used_images || images))
        else used_images end,
        images = null
      where day = p_day;
    end if;
  end if;

  return coalesce((
    select jsonb_object_agg(day, jsonb_build_object('images', images))
    from public.real_vs_ai_daily_challenges where cardinality(images) > 0
  ), '{}'::jsonb);
end;
$$;

revoke all on function public.real_vs_ai_daily_schedule(text, date, text[]) from public, anon, authenticated;
grant execute on function public.real_vs_ai_daily_schedule(text, date, text[]) to service_role;

commit;
