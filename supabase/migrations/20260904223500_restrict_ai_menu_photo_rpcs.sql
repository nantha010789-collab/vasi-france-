-- Supabase projects can have explicit anon EXECUTE grants in addition to the
-- PostgreSQL PUBLIC grant, so remove both for owner-only photo workflows.
revoke all on function public.vasi_restaurant_set_menu_photo_pending(uuid,text,text) from public, anon;
revoke all on function public.vasi_restaurant_finish_menu_photo_review(uuid,text,text,numeric) from public, anon;
grant execute on function public.vasi_restaurant_set_menu_photo_pending(uuid,text,text) to authenticated;
grant execute on function public.vasi_restaurant_finish_menu_photo_review(uuid,text,text,numeric) to authenticated;
