-- JARVIS · migração 002 · perfil/username, origem dos registros, auditoria e eventos completos
-- Aditiva e idempotente: NÃO apaga tabelas, colunas nem dados. Execute depois da 001.

-- ---------- Perfil ----------
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists onboarding_completed boolean default false;
-- username é único sem diferenciar maiúsculas/minúsculas (e-mail NÃO é username)
create unique index if not exists profiles_username_lower_uidx on public.profiles (lower(username)) where username is not null;

-- Disponibilidade de username, chamável antes do login (só devolve true/false, nunca dados de perfil)
create or replace function public.username_available(name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(name));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------- Tarefas ----------
alter table public.tasks add column if not exists category text;
alter table public.tasks add column if not exists source text default 'manual';
alter table public.tasks add column if not exists source_message_id uuid;
alter table public.tasks add column if not exists completed_at timestamptz;

-- ---------- Lembretes ----------
alter table public.reminders add column if not exists source text default 'manual';

-- ---------- Agenda ----------
alter table public.calendar_events add column if not exists ends_at timestamptz;
alter table public.calendar_events add column if not exists description text;
alter table public.calendar_events add column if not exists location text;
alter table public.calendar_events add column if not exists source text default 'manual';

-- ---------- Auditoria ----------
alter table public.audit_logs add column if not exists origin text;
alter table public.audit_logs add column if not exists error text;

-- ---------- Confirmações ----------
alter table public.action_confirmations add column if not exists resolved_at timestamptz;

-- ---------- Permissões padrão por usuário: nada é criado automaticamente ----------
-- O app trata a ausência de linha como o padrão (memória, tarefas, lembretes, calendário, notificações liberados;
-- e-mail, mensagens, pagamentos e compras bloqueados).

-- ---------- Confirmação de e-mail (configuração no painel, não em SQL) ----------
-- Authentication → URL Configuration:
--   Site URL:       https://SEU-APP.vercel.app
--   Redirect URLs:  https://SEU-APP.vercel.app/auth/callback
--                   https://SEU-APP.vercel.app/**
-- Se o Site URL continuar como http://localhost:3000, os links dos e-mails apontarão para localhost.
