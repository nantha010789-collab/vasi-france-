create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

drop function if exists public.submit_ride_rating(uuid, integer, text);

create or replace function private.prepare_ride_rating()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;

  select r.customer_id, r.driver_id
    into new.customer_id, new.driver_id
  from public.rides r
  where r.id = new.ride_id
    and r.customer_id = auth.uid()
    and r.status::text = 'completed'
    and r.driver_id is not null;

  if not found then
    raise exception 'Only a completed ride can be rated' using errcode = '42501';
  end if;

  if char_length(coalesce(new.comment, '')) > 500 then
    raise exception 'Feedback must be 500 characters or fewer' using errcode = '22023';
  end if;

  new.comment := nullif(btrim(coalesce(new.comment, '')), '');
  return new;
end;
$$;

create or replace function private.refresh_driver_rating()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.drivers d
  set rating = (
    select round(avg(rr.rating)::numeric, 2)
    from public.ride_ratings rr
    where rr.driver_id = new.driver_id
  )
  where d.id = new.driver_id;

  return new;
end;
$$;

revoke all on function private.prepare_ride_rating() from public;
revoke all on function private.prepare_ride_rating() from anon;
revoke all on function private.prepare_ride_rating() from authenticated;
revoke all on function private.refresh_driver_rating() from public;
revoke all on function private.refresh_driver_rating() from anon;
revoke all on function private.refresh_driver_rating() from authenticated;

drop trigger if exists ride_ratings_prepare on public.ride_ratings;
create trigger ride_ratings_prepare
before insert on public.ride_ratings
for each row execute function private.prepare_ride_rating();

drop trigger if exists ride_ratings_refresh_driver on public.ride_ratings;
create trigger ride_ratings_refresh_driver
after insert on public.ride_ratings
for each row execute function private.refresh_driver_rating();

drop policy if exists ride_ratings_participants_read on public.ride_ratings;
drop policy if exists ride_ratings_customer_insert on public.ride_ratings;

create policy ride_ratings_participants_read
on public.ride_ratings
for select
to authenticated
using (
  customer_id = (select auth.uid())
  or exists (
    select 1
    from public.drivers d
    where d.id = ride_ratings.driver_id
      and (
        d.user_id = (select auth.uid())
        or d.id = (select auth.uid())
      )
  )
);

create policy ride_ratings_customer_insert
on public.ride_ratings
for insert
to authenticated
with check (
  customer_id = (select auth.uid())
  and exists (
    select 1
    from public.rides r
    where r.id = ride_ratings.ride_id
      and r.customer_id = (select auth.uid())
      and r.driver_id = ride_ratings.driver_id
      and r.status::text = 'completed'
  )
);

revoke all on table public.ride_ratings from anon;
revoke all on table public.ride_ratings from authenticated;
grant select on table public.ride_ratings to authenticated;
grant insert (ride_id, rating, comment) on table public.ride_ratings to authenticated;
