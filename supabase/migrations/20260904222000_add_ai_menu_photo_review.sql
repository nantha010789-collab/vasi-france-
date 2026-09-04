-- Restaurant food photos: public delivery assets with owner-only writes and
-- server/admin controlled approval state.

alter table public.restaurant_menu_items
  add column if not exists photo_path text,
  add column if not exists photo_candidate_url text,
  add column if not exists photo_status text not null default 'none',
  add column if not exists photo_review_reason text,
  add column if not exists photo_ai_confidence numeric(4,3),
  add column if not exists photo_checked_at timestamptz,
  add column if not exists photo_reviewed_by uuid references auth.users(id) on delete set null;

alter table public.restaurant_menu_items
  drop constraint if exists restaurant_menu_items_photo_status_check;
alter table public.restaurant_menu_items
  add constraint restaurant_menu_items_photo_status_check
  check (photo_status in ('none','checking','approved','needs_changes','admin_review'));

create index if not exists restaurant_menu_items_photo_review_idx
  on public.restaurant_menu_items (photo_status, updated_at desc)
  where photo_status in ('checking','admin_review','needs_changes');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-menu-photos',
  'restaurant-menu-photos',
  true,
  2097152,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "restaurant owners upload menu photos" on storage.objects;
create policy "restaurant owners upload menu photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'restaurant-menu-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "restaurant owners view menu photos" on storage.objects;
create policy "restaurant owners view menu photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'restaurant-menu-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "restaurant owners update menu photos" on storage.objects;
create policy "restaurant owners update menu photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'restaurant-menu-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'restaurant-menu-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "restaurant owners delete menu photos" on storage.objects;
create policy "restaurant owners delete menu photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'restaurant-menu-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

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

-- Safe fallback used when the server cannot perform a privileged approval.
-- Restaurant owners can never self-approve a photo through this RPC.
create or replace function public.vasi_restaurant_finish_menu_photo_review(
  p_item_id uuid,
  p_status text,
  p_reason text,
  p_confidence numeric default null
) returns public.restaurant_menu_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_item public.restaurant_menu_items;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_status := case when p_status = 'needs_changes' then 'needs_changes' else 'admin_review' end;

  update public.restaurant_menu_items mi
  set photo_url = null,
      photo_status = v_status,
      photo_review_reason = left(coalesce(nullif(trim(p_reason), ''), 'Queued for VASI review'), 240),
      photo_ai_confidence = case when p_confidence between 0 and 1 then p_confidence else null end,
      photo_checked_at = now(),
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
revoke all on function public.vasi_restaurant_finish_menu_photo_review(uuid,text,text,numeric) from public, anon;
grant execute on function public.vasi_restaurant_set_menu_photo_pending(uuid,text,text) to authenticated;
grant execute on function public.vasi_restaurant_finish_menu_photo_review(uuid,text,text,numeric) to authenticated;
