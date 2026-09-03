do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'eats_orders'
  ) then
    alter publication supabase_realtime add table public.eats_orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'delivery_orders'
  ) then
    alter publication supabase_realtime add table public.delivery_orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vasi_dispatch_offers'
  ) then
    alter publication supabase_realtime add table public.vasi_dispatch_offers;
  end if;
end
$$;