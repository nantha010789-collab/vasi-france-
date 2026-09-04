create table public.ride_messages (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  message text not null
    check (char_length(btrim(message)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index ride_messages_ride_created_idx
  on public.ride_messages (ride_id, created_at);

alter table public.ride_messages enable row level security;

create policy ride_messages_participants_read
on public.ride_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.rides r
    where r.id = ride_messages.ride_id
      and (
        r.customer_id = (select auth.uid())
        or exists (
          select 1
          from public.drivers d
          where d.id = r.driver_id
            and (
              d.user_id = (select auth.uid())
              or d.id = (select auth.uid())
            )
        )
      )
  )
);

create policy ride_messages_active_participants_insert
on public.ride_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.rides r
    where r.id = ride_messages.ride_id
      and r.driver_id is not null
      and r.status::text in ('accepted', 'driver_arriving', 'in_progress')
      and (
        r.customer_id = (select auth.uid())
        or exists (
          select 1
          from public.drivers d
          where d.id = r.driver_id
            and (
              d.user_id = (select auth.uid())
              or d.id = (select auth.uid())
            )
        )
      )
  )
);

revoke all on table public.ride_messages from anon;
revoke all on table public.ride_messages from authenticated;
grant select on table public.ride_messages to authenticated;
grant insert (ride_id, message) on table public.ride_messages to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ride_messages'
  ) then
    alter publication supabase_realtime add table public.ride_messages;
  end if;
end
$$;

comment on table public.ride_messages is
  'Private in-ride chat messages visible only to the ride customer and assigned driver.';
