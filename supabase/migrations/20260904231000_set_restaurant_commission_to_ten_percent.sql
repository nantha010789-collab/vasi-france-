-- VASI restaurant commission is a permanent 10% of the food subtotal.
-- Delivery fees are excluded and remain available to fund courier payouts.

alter table public.restaurants
  alter column commission_rate set default 0.10;

update public.restaurants
set commission_rate = 0.10,
    updated_at = now()
where commission_rate is distinct from 0.10;

alter table public.restaurants
  drop constraint if exists restaurants_commission_rate_check;

alter table public.restaurants
  add constraint restaurants_commission_rate_check check (commission_rate = 0.10);

comment on column public.restaurants.commission_rate is
  'Restaurant commission as a decimal fraction. VASI standard rate is 0.10 (10%).';

comment on column public.restaurants.launch_commission_ends_at is
  'Deprecated compatibility field. VASI no longer uses a time-limited restaurant commission.';

alter table public.eats_orders
  add column if not exists commission_rate numeric not null default 0.10,
  add column if not exists restaurant_commission numeric not null default 0,
  add column if not exists restaurant_net numeric not null default 0;

update public.eats_orders
set commission_rate = 0.10,
    restaurant_commission = round(subtotal * 0.10, 2),
    restaurant_net = round(subtotal - (subtotal * 0.10), 2);

alter table public.eats_orders
  drop constraint if exists eats_orders_commission_rate_check,
  drop constraint if exists eats_orders_restaurant_commission_check,
  drop constraint if exists eats_orders_restaurant_net_check;

alter table public.eats_orders
  add constraint eats_orders_commission_rate_check check (commission_rate = 0.10),
  add constraint eats_orders_restaurant_commission_check check (restaurant_commission >= 0 and restaurant_commission <= subtotal),
  add constraint eats_orders_restaurant_net_check check (restaurant_net >= 0 and restaurant_net <= subtotal);

create or replace function public.vasi_register_restaurant(
  p_name text,
  p_legal_name text,
  p_siret text,
  p_phone text,
  p_email text,
  p_address text,
  p_city text,
  p_postal_code text,
  p_cuisine text,
  p_delivery_mode text
)
returns public.restaurants
language plpgsql
security definer
set search_path = public
as $function$
declare
  r public.restaurants;
  m text;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  if exists(select 1 from public.restaurants where owner_id = auth.uid()) then
    raise exception 'Restaurant already registered';
  end if;
  if length(trim(p_name)) < 2 or length(trim(p_legal_name)) < 2 or p_siret !~ '^[0-9 ]{9,17}$' then
    raise exception 'Invalid restaurant details';
  end if;
  m := case when p_delivery_mode = 'own' then 'own' else 'vasi' end;
  insert into public.restaurants(
    owner_id,name,legal_name,siret,phone,email,address,city,postal_code,cuisine,delivery_mode,commission_rate
  ) values (
    auth.uid(),left(trim(p_name),160),left(trim(p_legal_name),160),left(trim(p_siret),17),
    left(trim(p_phone),160),left(trim(p_email),160),left(trim(p_address),160),left(trim(p_city),160),
    left(trim(p_postal_code),160),left(trim(p_cuisine),160),m,0.10
  ) returning * into r;
  return r;
end
$function$;

revoke all on function public.vasi_register_restaurant(text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.vasi_register_restaurant(text,text,text,text,text,text,text,text,text,text) to authenticated;

create or replace function public.vasi_review_restaurant(
  p_restaurant_id uuid,
  p_status text,
  p_reason text default null,
  p_commission_rate numeric default null
)
returns public.restaurants
language plpgsql
security definer
set search_path = public
as $function$
declare
  r public.restaurants;
begin
  if not public.vasi_is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
  update public.restaurants
  set status = p_status,
      active = (p_status = 'approved'),
      is_open = false,
      rejection_reason = case when p_status = 'rejected' then left(coalesce(p_reason,'Application needs changes'),300) else null end,
      commission_rate = 0.10,
      updated_at = now()
  where id = p_restaurant_id
  returning * into r;
  if r.id is null then raise exception 'Restaurant not found'; end if;
  return r;
end
$function$;

revoke all on function public.vasi_review_restaurant(uuid,text,text,numeric) from public;
grant execute on function public.vasi_review_restaurant(uuid,text,text,numeric) to authenticated;
