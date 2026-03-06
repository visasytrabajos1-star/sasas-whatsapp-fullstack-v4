-- FASE 2: Versionado de Super Prompts
create table if not exists public.prompt_versiones (
  id uuid primary key,
  tenant_id text not null,
  instance_id text not null,
  version text not null default 'v1',
  status text not null default 'test',
  prompt_text text not null,
  super_prompt_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_prompt_versiones_tenant_instance_created
  on public.prompt_versiones (tenant_id, instance_id, created_at desc);

create index if not exists idx_prompt_versiones_status
  on public.prompt_versiones (status);
