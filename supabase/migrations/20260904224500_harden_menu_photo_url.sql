-- Only allow menu-photo candidates hosted in VASI's own Storage bucket.
create or replace function public.vasi_restaurant_set_menu_photo_pending(
  p_item_id uuid,
  p_photo_path text,
  p_candidate_url text
) returns public.restaurant_menu_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.restaurant_menu_items;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if split_part(p_photo_path, '/', 1) <> auth.uid()::text
     or split_part(p_photo_path, '/', 2) <> p_item_id::text
     or split_part(p_photo_path, '/', 3) !~ '^[0-9a-f-]{36}\.(jpg|png|webp)$'
     or split_part(p_photo_path, '/', 4) <> ''
     or p_candidate_url <> 'https://vhfyvkrvysrooaqzcxsp.supabase.co/storage/v1/object/public/restaurant-menu-photos/' || p_photo_path then
    raise exception 'Invalid photo path';
  end if;

  update public.restaurant_menu_items mi
  set photo_path = p_photo_path,
      photo_candidate_url = p_candidate_url,
      photo_url = null,
      photo_status = 'checking',
      photo_review_reason = 'Automatic review in progress',
      photo_ai_confidence = null,
      photo_checked_at = null,
      photo_reviewed_by = null,
      updated_at = now()
  where mi.id = p_item_id
    and exists (
      select 1 from public.restaurants r
      where r.id = mi.restaurant_id and r.owner_id = auth.uid()
    )
  returning mi.* into v_item;

  if v_item.id is null then raise exception 'Menu item not found'; end if;
  return v_item;
end;
$$;

revoke all on function public.vasi_restaurant_set_menu_photo_pending(uuid,text,text) from public, anon;
grant execute on function public.vasi_restaurant_set_menu_photo_pending(uuid,text,text) to authenticated;
