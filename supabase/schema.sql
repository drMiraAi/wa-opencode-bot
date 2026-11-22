create table if not exists wa_auth (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists wa_meta (
  id text primary key,
  session_id text,
  qr_disabled boolean not null default false
);

insert into wa_meta (id, session_id, qr_disabled)
values ('singleton', null, false)
on conflict (id) do nothing;

create table if not exists wa_transcript (
  id bigint generated always as identity primary key,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  at timestamptz not null
);
