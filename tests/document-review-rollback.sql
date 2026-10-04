-- Run only as a privileged test transaction. All synthetic records roll back.
begin;
set local request.jwt.claim.role='service_role';
do $$
declare applicant uuid:=gen_random_uuid(); document_id uuid; courier_id uuid; blocked boolean;
begin
  insert into auth.users(id) values(applicant);
  insert into public.drivers(id,user_id,full_name,phone) values(applicant,applicant,'Synthetic review test','');
  insert into public.driver_documents(driver_id,document_type,file_path) values(applicant,'identity_back',applicant::text||'/test-back.jpg') returning id into document_id;
  blocked:=false;
  begin update public.driver_documents set status='approved' where id=document_id;
  exception when others then if sqlerrm like '%manual review evidence%' then blocked:=true; else raise; end if; end;
  if not blocked then raise exception 'Bare document approval unexpectedly succeeded'; end if;
  blocked:=false;
  begin update public.drivers set verified=true,status='approved' where id=applicant;
  exception when others then if sqlerrm like '%Eight distinct%' then blocked:=true; else raise; end if; end;
  if not blocked then raise exception 'Incomplete driver approval unexpectedly succeeded'; end if;
  insert into public.delivery_drivers(user_id,full_name,vehicle_type) values(applicant,'Synthetic review test','bike') returning id into courier_id;
  blocked:=false;
  begin update public.delivery_drivers set verified=true,application_status='approved' where id=courier_id;
  exception when others then if sqlerrm like '%manual review evidence%' or sqlerrm like '%Courier identity changed%' then blocked:=true; else raise; end if; end;
  if not blocked then raise exception 'Bare courier approval unexpectedly succeeded'; end if;
end $$;
rollback;
select 'All three approval bypass attempts rejected; synthetic records rolled back' as result;
