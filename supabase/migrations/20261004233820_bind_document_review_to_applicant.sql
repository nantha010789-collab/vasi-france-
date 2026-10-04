alter table public.driver_documents add column reviewed_name text;

create or replace function public.vasi_require_document_review() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.status='pending' then
    new.reviewed_name:=null; new.review_checks:='{}'; new.review_note:=null; new.file_sha256:=null; new.reviewed_by:=null; new.reviewed_at:=null; new.expires_at:=null;
  elsif new.status='approved' then
    if not public.vasi_review_complete(new.review_checks,new.review_note) or new.reviewed_by is null or new.reviewed_at is null
      or length(coalesce(new.reviewed_name,''))<2 or new.file_sha256 is null or new.file_sha256 !~ '^[a-f0-9]{64}$' then
      raise exception 'Document approval requires recorded manual review evidence';
    end if;
    if new.document_type in ('identity','vtc','licence','insurance') and (new.expires_at is null or new.expires_at<=current_date) then
      raise exception 'Expired or missing expiry date';
    end if;
  end if;
  return new;
end $$;

create or replace function public.vasi_require_driver_dossier() returns trigger language plpgsql security invoker set search_path='' as $$
declare n integer; unique_files integer;
begin
  if tg_op='UPDATE' and old.verified and new.full_name is distinct from old.full_name then
    raise exception 'Approved identity is locked; request a new review before changing the name';
  end if;
  if new.verified and (tg_op='INSERT' or not old.verified) then
    select count(*),count(distinct d.file_sha256) into n,unique_files from public.driver_documents d
    where d.driver_id=new.id and d.document_type=any(array['identity','identity_back','vtc','licence','business','insurance','carte_grise','selfie'])
      and d.reviewed_name=new.full_name and d.status='approved' and public.vasi_review_complete(d.review_checks,d.review_note)
      and (d.expires_at is null or d.expires_at>current_date) and d.file_path like new.id::text||'/%'
      and exists(select 1 from storage.objects o where o.bucket_id='partner-documents' and o.name=d.file_path);
    if n<>8 or unique_files<>8 then raise exception 'Eight distinct, reviewed documents including both ID sides are required'; end if;
  end if;
  return new;
end $$;

create or replace function public.vasi_require_courier_dossier() returns trigger language plpgsql security invoker set search_path='' as $$
declare required text[]:=array['identity','identity_back','business','bag','vehicle_photo','selfie']; kind text; hashes text[]:='{}'; hash text;
begin
  if tg_op='UPDATE' and old.verified and (new.documents is distinct from old.documents or new.full_name is distinct from old.full_name or new.vehicle_type is distinct from old.vehicle_type) then
    raise exception 'Approved dossier is locked; request a new review before changing identity or documents';
  end if;
  if not new.verified then new.identity_review:=null; return new; end if;
  if tg_op='INSERT' or not old.verified then
    if new.identity_review->>'reviewed_name' is distinct from new.full_name then raise exception 'Courier identity changed; a new review is required'; end if;
    if not public.vasi_review_complete(new.identity_review->'checks',new.identity_review->>'note') or new.reviewed_by is null or new.reviewed_at is null then
      raise exception 'Courier approval requires recorded manual review evidence';
    end if;
    if new.vehicle_type in ('scooter','moto','car') then required:=required||array['licence','insurance','carte_grise','transport_licence']; end if;
    foreach kind in array required loop
      hash:=new.identity_review->'file_hashes'->>kind;
      if coalesce(new.documents->>kind,'')='' or not coalesce(new.documents->>kind like new.user_id::text||'/%',false)
        or new.identity_review->'document_paths'->>kind is distinct from new.documents->>kind
        or hash is null or hash !~ '^[a-f0-9]{64}$' or hash=any(hashes)
        or not exists(select 1 from storage.objects o where o.bucket_id='partner-documents' and o.name=new.documents->>kind)
      then raise exception 'Missing, stale or duplicate courier document: %',kind; end if;
      hashes:=array_append(hashes,hash);
    end loop;
  end if;
  return new;
end $$;
