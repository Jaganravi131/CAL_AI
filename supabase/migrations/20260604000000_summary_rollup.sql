-- Auto-sync daily_summaries when meal_logs are inserted, updated, or deleted
create or replace function public.sync_daily_summary()
returns trigger as $$
declare
  target_date date;
  target_user uuid;
begin
  if (tg_op = 'DELETE') then
    target_date := old.eaten_at::date;
    target_user := old.user_id;
  else
    target_date := new.eaten_at::date;
    target_user := new.user_id;
  end if;

  insert into public.daily_summaries (user_id, summary_date, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g)
  select
    target_user,
    target_date,
    coalesce(sum(total_calories), 0),
    coalesce(sum(total_protein_g), 0),
    coalesce(sum(total_carbs_g), 0),
    coalesce(sum(total_fat_g), 0)
  from public.meal_logs
  where user_id = target_user and eaten_at::date = target_date
  on conflict (user_id, summary_date) do update set
    calories_consumed = excluded.calories_consumed,
    protein_consumed_g = excluded.protein_consumed_g,
    carbs_consumed_g = excluded.carbs_consumed_g,
    fat_consumed_g = excluded.fat_consumed_g,
    updated_at = now();

  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_sync_daily_summary on public.meal_logs;
create trigger tr_sync_daily_summary
after insert or update or delete on public.meal_logs
for each row execute function public.sync_daily_summary();
