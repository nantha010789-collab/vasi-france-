alter table public.restaurants
  add column if not exists opening_hours jsonb not null default '{"monday":"11:00-22:30","tuesday":"11:00-22:30","wednesday":"11:00-22:30","thursday":"11:00-22:30","friday":"11:00-23:00","saturday":"11:00-23:00","sunday":"closed"}'::jsonb;

alter table public.restaurants
  drop constraint if exists restaurants_opening_hours_object_check;
alter table public.restaurants
  add constraint restaurants_opening_hours_object_check
  check (jsonb_typeof(opening_hours) = 'object');

alter table public.eats_orders
  add column if not exists restaurant_preparation_minutes integer;

alter table public.eats_orders
  drop constraint if exists eats_orders_restaurant_preparation_minutes_check;
alter table public.eats_orders
  add constraint eats_orders_restaurant_preparation_minutes_check
  check (
    restaurant_preparation_minutes is null
    or restaurant_preparation_minutes between 5 and 120
  );

create or replace function public.vasi_restaurant_update_profile(
  p_name text,
  p_phone text,
  p_address text,
  p_city text,
  p_postal_code text,
  p_cuisine text,
  p_preparation_minutes integer,
  p_minimum_order numeric,
  p_delivery_fee numeric,
  p_opening_hours jsonb
) returns public.restaurants
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result public.restaurants;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2
     or char_length(btrim(coalesce(p_phone, ''))) < 6
     or char_length(btrim(coalesce(p_address, ''))) < 4
     or char_length(btrim(coalesce(p_city, ''))) < 2
     or char_length(btrim(coalesce(p_postal_code, ''))) < 4
     or char_length(btrim(coalesce(p_cuisine, ''))) < 2
     or p_preparation_minutes not between 5 and 120
     or p_minimum_order < 0 or p_minimum_order > 500
     or p_delivery_fee < 0 or p_delivery_fee > 100
     or jsonb_typeof(p_opening_hours) <> 'object' then
    raise exception 'Invalid restaurant profile';
  end if;

  update public.restaurants
  set name = left(btrim(p_name), 120),
      phone = left(btrim(p_phone), 40),
      address = left(btrim(p_address), 180),
      city = left(btrim(p_city), 100),
      postal_code = left(btrim(p_postal_code), 16),
      cuisine = left(btrim(p_cuisine), 80),
      preparation_minutes = p_preparation_minutes,
      minimum_order = p_minimum_order,
      delivery_fee = p_delivery_fee,
      opening_hours = p_opening_hours,
      updated_at = now()
  where owner_id = auth.uid()
  returning * into result;

  if result.id is null then
    raise exception 'Restaurant not found' using errcode = '42501';
  end if;
  return result;
end;
$$;

create or replace function public.vasi_restaurant_update_item(
  p_item_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_price numeric,
  p_allergens text[],
  p_active boolean
) returns public.restaurant_menu_items
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result public.restaurant_menu_items;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2
     or p_price < 0.5 or p_price > 500 then
    raise exception 'Invalid menu item';
  end if;

  update public.restaurant_menu_items item
  set name = left(btrim(p_name), 100),
      description = left(coalesce(btrim(p_description), ''), 300),
      category = left(coalesce(nullif(btrim(p_category), ''), 'Menu'), 60),
      price = p_price,
      allergens = coalesce(p_allergens, '{}'::text[]),
      active = coalesce(p_active, true),
      updated_at = now()
  where item.id = p_item_id
    and exists (
      select 1 from public.restaurants restaurant
      where restaurant.id = item.restaurant_id
        and restaurant.owner_id = auth.uid()
    )
  returning item.* into result;

  if result.id is null then
    raise exception 'Menu item not found' using errcode = '42501';
  end if;
  return result;
end;
$$;

create or replace function public.vasi_restaurant_delete_item(p_item_id uuid)
returns public.restaurant_menu_items
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result public.restaurant_menu_items;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;

  delete from public.restaurant_menu_items item
  where item.id = p_item_id
    and exists (
      select 1 from public.restaurants restaurant
      where restaurant.id = item.restaurant_id
        and restaurant.owner_id = auth.uid()
    )
  returning item.* into result;

  if result.id is null then
    raise exception 'Menu item not found' using errcode = '42501';
  end if;
  return result;
end;
$$;

create or replace function public.vasi_restaurant_accept_order(
  p_order_id uuid,
  p_preparation_minutes integer
) returns public.eats_orders
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result public.eats_orders;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;
  if p_preparation_minutes not between 5 and 120 then
    raise exception 'Preparation time must be between 5 and 120 minutes';
  end if;

  update public.eats_orders order_row
  set status = 'accepted',
      accepted_at = coalesce(order_row.accepted_at, now()),
      restaurant_preparation_minutes = p_preparation_minutes
  where order_row.id = p_order_id
    and order_row.status = 'pending'
    and order_row.payment_status = 'paid'
    and exists (
      select 1 from public.restaurants restaurant
      where restaurant.id = order_row.restaurant_id
        and restaurant.owner_id = auth.uid()
    )
  returning order_row.* into result;

  if result.id is null then
    raise exception 'Paid pending order not found' using errcode = '42501';
  end if;
  return result;
end;
$$;

revoke all on function public.vasi_restaurant_update_profile(text,text,text,text,text,text,integer,numeric,numeric,jsonb) from public, anon;
revoke all on function public.vasi_restaurant_update_item(uuid,text,text,text,numeric,text[],boolean) from public, anon;
revoke all on function public.vasi_restaurant_delete_item(uuid) from public, anon;
revoke all on function public.vasi_restaurant_accept_order(uuid,integer) from public, anon;

grant execute on function public.vasi_restaurant_update_profile(text,text,text,text,text,text,integer,numeric,numeric,jsonb) to authenticated;
grant execute on function public.vasi_restaurant_update_item(uuid,text,text,text,numeric,text[],boolean) to authenticated;
grant execute on function public.vasi_restaurant_delete_item(uuid) to authenticated;
grant execute on function public.vasi_restaurant_accept_order(uuid,integer) to authenticated;
