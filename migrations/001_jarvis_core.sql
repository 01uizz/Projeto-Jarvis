-- JARVIS · migração 001 · colunas usadas pelo app + RLS por usuário
-- Idempotente: pode ser executada mais de uma vez no SQL Editor do Supabase.
-- IMPORTANTE: o app assume as colunas abaixo. Se alguma tabela existente tiver outro formato
-- ou colunas NOT NULL extras, ajuste a tabela ou o código em src/ antes de usar.

-- ---------- Colunas usadas pelo app ----------
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade);
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;

create table if not exists public.user_settings (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.user_settings add column if not exists autonomy_level int not null default 1;

create table if not exists public.theme_preferences (id uuid primary key default gen_random_uuid());
alter table public.theme_preferences add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.theme_preferences add column if not exists accent_color text default 'red';
alter table public.theme_preferences add column if not exists theme_mode text default 'dark';
alter table public.theme_preferences add column if not exists created_at timestamptz default now();
alter table public.theme_preferences add column if not exists updated_at timestamptz default now();

create table if not exists public.conversations (id uuid primary key default gen_random_uuid());
alter table public.conversations add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.conversations add column if not exists title text;
alter table public.conversations add column if not exists created_at timestamptz default now();
alter table public.conversations add column if not exists updated_at timestamptz default now();

create table if not exists public.messages (id uuid primary key default gen_random_uuid());
alter table public.messages add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.messages add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;
alter table public.messages add column if not exists role text;
alter table public.messages add column if not exists content text;
alter table public.messages add column if not exists metadata jsonb;
alter table public.messages add column if not exists created_at timestamptz default now();

create table if not exists public.memories (id uuid primary key default gen_random_uuid());
alter table public.memories add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.memories add column if not exists content text;
alter table public.memories add column if not exists category text;
alter table public.memories add column if not exists source text;
alter table public.memories add column if not exists confidence numeric;
alter table public.memories add column if not exists is_active boolean default true;
alter table public.memories add column if not exists created_at timestamptz default now();
alter table public.memories add column if not exists updated_at timestamptz default now();

create table if not exists public.tasks (id uuid primary key default gen_random_uuid());
alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tasks add column if not exists title text;
alter table public.tasks add column if not exists description text;
alter table public.tasks add column if not exists due_at timestamptz;
alter table public.tasks add column if not exists priority text default 'medium';
alter table public.tasks add column if not exists status text default 'pending';
alter table public.tasks add column if not exists completed_at timestamptz;
alter table public.tasks add column if not exists created_at timestamptz default now();
alter table public.tasks add column if not exists updated_at timestamptz default now();

create table if not exists public.reminders (id uuid primary key default gen_random_uuid());
alter table public.reminders add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.reminders add column if not exists message text;
alter table public.reminders add column if not exists remind_at timestamptz;
alter table public.reminders add column if not exists status text default 'pending';
alter table public.reminders add column if not exists created_at timestamptz default now();

create table if not exists public.calendar_events (id uuid primary key default gen_random_uuid());
alter table public.calendar_events add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.calendar_events add column if not exists title text;
alter table public.calendar_events add column if not exists starts_at timestamptz;
alter table public.calendar_events add column if not exists ends_at timestamptz;
alter table public.calendar_events add column if not exists created_at timestamptz default now();

create table if not exists public.notifications (id uuid primary key default gen_random_uuid());
alter table public.notifications add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.notifications add column if not exists title text;
alter table public.notifications add column if not exists body text;
alter table public.notifications add column if not exists kind text;
alter table public.notifications add column if not exists read_at timestamptz;
alter table public.notifications add column if not exists created_at timestamptz default now();

create table if not exists public.user_permissions (id uuid primary key default gen_random_uuid());
alter table public.user_permissions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.user_permissions add column if not exists permission text;
alter table public.user_permissions add column if not exists granted boolean default false;

create table if not exists public.integrations (id uuid primary key default gen_random_uuid());
alter table public.integrations add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.integrations add column if not exists provider text;
alter table public.integrations add column if not exists status text default 'disconnected';

create table if not exists public.action_confirmations (id uuid primary key default gen_random_uuid());
alter table public.action_confirmations add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.action_confirmations add column if not exists tool text;
alter table public.action_confirmations add column if not exists params jsonb;
alter table public.action_confirmations add column if not exists summary text;
alter table public.action_confirmations add column if not exists status text default 'pending';
alter table public.action_confirmations add column if not exists created_at timestamptz default now();
alter table public.action_confirmations add column if not exists resolved_at timestamptz;

create table if not exists public.audit_logs (id uuid primary key default gen_random_uuid());
alter table public.audit_logs add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.audit_logs add column if not exists action text;
alter table public.audit_logs add column if not exists tool text;
alter table public.audit_logs add column if not exists status text;
alter table public.audit_logs add column if not exists result text;
alter table public.audit_logs add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.audit_logs add column if not exists created_at timestamptz default now();

-- ---------- Índices únicos usados por upsert ----------
create unique index if not exists theme_preferences_user_uidx on public.theme_preferences (user_id);
create unique index if not exists user_permissions_user_perm_uidx on public.user_permissions (user_id, permission);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);
create index if not exists reminders_due_idx on public.reminders (user_id, status, remind_at);
create index if not exists tasks_user_idx on public.tasks (user_id, status, due_at);

-- ---------- RLS: cada usuário acessa somente os próprios dados ----------
do $$
declare
  t text;
  owned text[] := array[
    'user_settings','theme_preferences','conversations','messages','memories','tasks','reminders',
    'calendar_events','notifications','user_permissions','integrations','action_confirmations'
  ];
begin
  foreach t in array owned loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "jarvis_own_select" on public.%I', t);
    execute format('drop policy if exists "jarvis_own_insert" on public.%I', t);
    execute format('drop policy if exists "jarvis_own_update" on public.%I', t);
    execute format('drop policy if exists "jarvis_own_delete" on public.%I', t);
    execute format('create policy "jarvis_own_select" on public.%I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy "jarvis_own_insert" on public.%I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy "jarvis_own_update" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "jarvis_own_delete" on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- profiles usa "id" como chave do usuário
alter table public.profiles enable row level security;
drop policy if exists "jarvis_own_select" on public.profiles;
drop policy if exists "jarvis_own_insert" on public.profiles;
drop policy if exists "jarvis_own_update" on public.profiles;
create policy "jarvis_own_select" on public.profiles for select to authenticated using (id = auth.uid());
create policy "jarvis_own_insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "jarvis_own_update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- audit_logs: o usuário pode ler e criar os seus registros, mas não alterar nem apagar (trilha de auditoria)
alter table public.audit_logs enable row level security;
drop policy if exists "jarvis_own_select" on public.audit_logs;
drop policy if exists "jarvis_own_insert" on public.audit_logs;
create policy "jarvis_own_select" on public.audit_logs for select to authenticated using (user_id = auth.uid());
create policy "jarvis_own_insert" on public.audit_logs for insert to authenticated with check (user_id = auth.uid());

-- Demais tabelas do projeto (tools, capabilities, automations, secret_references, web_searches etc.)
-- não são usadas pelo app nesta versão. Mantenha RLS ativo nelas e crie políticas por user_id
-- antes de começar a usá-las. secret_references nunca deve ser legível pelo navegador.
