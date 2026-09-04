-- Calculate the restaurant settlement inside Postgres so a client cannot
-- lower VASI's commission by submitting different settlement values.

create or replace function public.vasi_set_eats_order_commission()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  new.commission_rate := 0.10;
  new.restaurant_commission := round(new.subtotal * 0.10, 2);
  new.restaurant_net := round(new.subtotal - new.restaurant_commission, 2);
  return new;
end
$function$;

revoke all on function public.vasi_set_eats_order_commission() from public;

drop trigger if exists vasi_set_eats_order_commission on public.eats_orders;
create trigger vasi_set_eats_order_commission
before insert or update of subtotal, commission_rate, restaurant_commission, restaurant_net
on public.eats_orders
for each row execute function public.vasi_set_eats_order_commission();

update public.eats_orders
set commission_rate = 0.10;

alter table public.eats_orders
  drop constraint if exists eats_orders_commission_rate_check,
  drop constraint if exists eats_orders_restaurant_commission_check,
  drop constraint if exists eats_orders_restaurant_net_check;

alter table public.eats_orders
  add constraint eats_orders_commission_rate_check
    check (commission_rate = 0.10),
  add constraint eats_orders_restaurant_commission_check
    check (restaurant_commission = round(subtotal * 0.10, 2)),
  add constraint eats_orders_restaurant_net_check
    check (restaurant_net = round(subtotal - restaurant_commission, 2));
