drop policy if exists "customer rate ride" on public.ride_ratings;
drop policy if exists "ratings participants" on public.ride_ratings;

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

revoke all on table public.ride_ratings from anon;
revoke all on table public.ride_ratings from authenticated;
grant select on table public.ride_ratings to authenticated;

create or replace function public.submit_ride_rating(
  p_ride_id uuid,
  p_rating integer,
  p_comment text default null
)
returns public.ride_ratings
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_customer_id uuid;
  v_driver_id uuid;
  v_rating public.ride_ratings;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5' using errcode = '22023';
  end if;

  if char_length(coalesce(p_comment, '')) > 500 then
    raise exception 'Feedback must be 500 characters or fewer' using errcode = '22023';
  end if;

  select r.customer_id, r.driver_id
    into v_customer_id, v_driver_id
  from public.rides r
  where r.id = p_ride_id
    and r.customer_id = auth.uid()
    and r.status::text = 'completed'
    and r.driver_id is not null;

  if not found then
    raise exception 'Only a completed ride can be rated' using errcode = '42501';
  end if;

  insert into public.ride_ratings (
    ride_id,
    customer_id,
    driver_id,
    rating,
    comment
  ) values (
    p_ride_id,
    v_customer_id,
    v_driver_id,
    p_rating,
    nullif(btrim(coalesce(p_comment, '')), '')
  )
  returning * into v_rating;

  update public.drivers d
  set rating = (
    select round(avg(rr.rating)::numeric, 2)
    from public.ride_ratings rr
    where rr.driver_id = v_driver_id
  )
  where d.id = v_driver_id;

  return v_rating;
exception
  when unique_violation then
    raise exception 'This ride has already been rated' using errcode = '23505';
end;
$$;

revoke all on function public.submit_ride_rating(uuid, integer, text) from public;
revoke all on function public.submit_ride_rating(uuid, integer, text) from anon;
grant execute on function public.submit_ride_rating(uuid, integer, text) to authenticated;

comment on table public.ride_ratings is
  'One customer rating for each completed VASI ride.';
