-- manifest: **Briefs: client requirement questionnaires as a provisioned module (ADR-0002, Sales CRM fork).** Creates `public.fn_briefs_provisionar()` (no parameter, EXECUTE only for service_role) which creates `brief_templates` (reusable question sets) and `briefs` (one per client project: a snapshot of the questions, the answers as jsonb and a share token for the public no-login link), then calls `fn_proteger_modulo_provisionado()`. Also creates `fn_brief_salvar_secao` (service_role only), which the public route uses to write ONE section of answers atomically, and the private `briefs` storage bucket for client uploads. Numbered 8001 to stay clear of the upstream 0xxx/9xxx ranges. Idempotent; mirrored in the baseline.sql appendix before the anon sweep.

-- ---- briefs: client requirement questionnaires (migration 8001, Sales CRM fork) ----
--
-- Reads go through the session client under RLS (members of the organization).
-- Every write goes through the service role after `requireRole` in the API, so
-- `authenticated` only gets SELECT. The public link never touches these tables
-- directly: it resolves the brief by `share_token` with the admin client and
-- writes through `fn_brief_salvar_secao`.

create or replace function public.fn_briefs_provisionar()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $f$
begin
  create table if not exists public.brief_templates (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    nome text not null check (char_length(btrim(nome)) between 1 and 200),
    descricao text check (descricao is null or char_length(descricao) <= 2000),
    secoes jsonb not null default '[]'::jsonb
      check (jsonb_typeof(secoes) = 'array' and octet_length(secoes::text) <= 400000),
    created_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table if not exists public.briefs (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    template_id uuid references public.brief_templates(id) on delete set null,
    titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
    cliente text check (cliente is null or char_length(cliente) <= 200),
    intro text check (intro is null or char_length(intro) <= 4000),
    secoes jsonb not null default '[]'::jsonb
      check (jsonb_typeof(secoes) = 'array' and octet_length(secoes::text) <= 400000),
    respostas jsonb not null default '{}'::jsonb
      check (jsonb_typeof(respostas) = 'object' and octet_length(respostas::text) <= 2000000),
    status text not null default 'rascunho'
      check (status in ('rascunho', 'enviado', 'em_andamento', 'concluido', 'arquivado')),
    share_token uuid not null default gen_random_uuid(),
    concluido_em timestamptz,
    created_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create unique index if not exists briefs_share_token_idx on public.briefs (share_token);
  create index if not exists briefs_org_updated_idx on public.briefs (organization_id, updated_at desc);
  create index if not exists brief_templates_org_idx on public.brief_templates (organization_id, nome);

  alter table public.brief_templates enable row level security;
  alter table public.briefs enable row level security;

  drop policy if exists brief_templates_member_select on public.brief_templates;
  create policy brief_templates_member_select on public.brief_templates
    for select using (
      organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin()
    );

  drop policy if exists briefs_member_select on public.briefs;
  create policy briefs_member_select on public.briefs
    for select using (
      organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin()
    );

  -- Explicit grants: Supabase stopped granting new public tables to API roles on 2026-10-30.
  revoke all on public.brief_templates from public, anon, authenticated;
  revoke all on public.briefs from public, anon, authenticated;
  grant select on public.brief_templates to authenticated;
  grant select on public.briefs to authenticated;
  grant all on public.brief_templates to service_role;
  grant all on public.briefs to service_role;

  perform public.fn_proteger_modulo_provisionado();
end;
$f$;

revoke execute on function public.fn_briefs_provisionar() from public, anon, authenticated;
grant execute on function public.fn_briefs_provisionar() to service_role;

comment on function public.fn_briefs_provisionar() is
  'Provisions the Briefs module (ADR-0002 D2): brief_templates and briefs exist only where the module is installed. No parameter, EXECUTE only for service_role (D4); ends in fn_proteger_modulo_provisionado() (D5).';

-- One section of answers, written atomically so two tabs (or the client and a
-- colleague) never overwrite each other's sections. Returns false when the link
-- is unknown or the brief is archived; the route turns that into a 404.
create or replace function public.fn_brief_salvar_secao(p_token uuid, p_secao text, p_dados jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $f$
declare
  v_ok boolean;
begin
  if to_regclass('public.briefs') is null then
    return false;
  end if;
  if p_secao is null or p_secao !~ '^[a-z0-9_-]{1,64}$' or jsonb_typeof(p_dados) <> 'object' then
    return false;
  end if;
  update public.briefs
     set respostas = jsonb_set(respostas, array[p_secao], p_dados, true),
         status = case when status in ('rascunho', 'enviado') then 'em_andamento' else status end,
         updated_at = now()
   where share_token = p_token
     and status <> 'arquivado'
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$f$;

revoke execute on function public.fn_brief_salvar_secao(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.fn_brief_salvar_secao(uuid, text, jsonb) to service_role;

-- Private bucket for client uploads. Only the server touches it: uploads use
-- signed upload URLs it issues, and downloads use short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'briefs', 'briefs', false, 20971520,
  array[
    'image/*', 'video/*', 'application/pdf', 'application/zip', 'text/plain',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/postscript', 'image/svg+xml'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
