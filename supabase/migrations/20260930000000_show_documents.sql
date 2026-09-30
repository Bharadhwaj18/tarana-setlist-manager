-- Show documents: quotations / invoices (PDF, image, Word) attached to a show.
-- Additive and safe to re-run. Files live in a private "show-documents" bucket.
-- Access follows the show's workspace, same as recordings: you can read/delete a file
-- only via a show_documents row in a workspace you belong to; uploads go into your own folder.

begin;

create table if not exists public.show_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  kind text not null default 'quotation' check (kind in ('quotation', 'invoice', 'other')),
  file_name text not null,
  file_path text not null,
  mime_type text not null,
  size_bytes integer not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists show_documents_show_idx on public.show_documents (show_id);

alter table public.show_documents enable row level security;

drop policy if exists ws_select on public.show_documents;
create policy ws_select on public.show_documents for select to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) <> 'none');
drop policy if exists ws_insert on public.show_documents;
create policy ws_insert on public.show_documents for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full');
drop policy if exists ws_update on public.show_documents;
create policy ws_update on public.show_documents for update to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full')
  with check (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full');
drop policy if exists ws_delete on public.show_documents;
create policy ws_delete on public.show_documents for delete to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_access(workspace_id) = 'full');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('show-documents', 'show-documents', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ws_sd_select on storage.objects;
create policy ws_sd_select on storage.objects for select to authenticated using (
  bucket_id = 'show-documents' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.show_documents d
               where d.file_path = storage.objects.name
                 and public.is_workspace_member(d.workspace_id)
                 and public.workspace_access(d.workspace_id) <> 'none')
  ));

drop policy if exists ws_sd_insert on storage.objects;
create policy ws_sd_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'show-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists ws_sd_delete on storage.objects;
create policy ws_sd_delete on storage.objects for delete to authenticated using (
  bucket_id = 'show-documents' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.show_documents d
               where d.file_path = storage.objects.name
                 and public.is_workspace_member(d.workspace_id)
                 and public.workspace_access(d.workspace_id) = 'full')
  ));

commit;
