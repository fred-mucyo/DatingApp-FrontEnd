create extension if not exists pgcrypto;

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  legal_name text not null,
  document_type text not null,
  status text not null default 'pending',
  review_notes text null,
  id_front_path text not null,
  id_back_path text null,
  selfie_path text null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by text null,
  documents_delete_after timestamptz null,
  documents_deleted_at timestamptz null
);

alter table public.verification_requests enable row level security;

create index if not exists verification_requests_user_id_idx on public.verification_requests(user_id);
create index if not exists verification_requests_status_idx on public.verification_requests(status);
create index if not exists verification_requests_documents_delete_after_idx on public.verification_requests(documents_delete_after);

alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists verified_at timestamptz null;

create or replace function public.set_verification_delete_after_on_review()
returns trigger
language plpgsql
as $$
begin
  if (new.reviewed_at is not null) then
    new.documents_delete_after := new.reviewed_at + interval '7 days';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_verification_delete_after_on_review on public.verification_requests;
create trigger trg_set_verification_delete_after_on_review
before update of reviewed_at
on public.verification_requests
for each row
execute function public.set_verification_delete_after_on_review();

create policy "verification_requests_insert_own" on public.verification_requests
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "verification_requests_select_own" on public.verification_requests
for select
to authenticated
using (auth.uid() = user_id);

create policy "verification_requests_update_own_pending" on public.verification_requests
for update
to authenticated
using (auth.uid() = user_id and status = 'pending')
with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "verification_docs_select_own" on storage.objects;
create policy "verification_docs_select_own" on storage.objects
for select
to authenticated
using (bucket_id = 'verification-docs' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "verification_docs_insert_own" on storage.objects;
create policy "verification_docs_insert_own" on storage.objects
for insert
to authenticated
with check (bucket_id = 'verification-docs' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "verification_docs_update_own" on storage.objects;
create policy "verification_docs_update_own" on storage.objects
for update
to authenticated
using (bucket_id = 'verification-docs' and split_part(name, '/', 1) = auth.uid()::text)
with check (bucket_id = 'verification-docs' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "verification_docs_delete_own" on storage.objects;
create policy "verification_docs_delete_own" on storage.objects
for delete
to authenticated
using (bucket_id = 'verification-docs' and split_part(name, '/', 1) = auth.uid()::text);
