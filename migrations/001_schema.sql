create table if not exists users (
  id            serial primary key,
  email         text unique not null,
  name          text not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table if not exists projects (
  id         serial primary key,
  slug       text unique not null,
  name       text not null,
  summary    text not null,
  visibility text not null default 'public',
  budget     integer,
  notes      text,
  owner_id   integer references users(id),
  created_at timestamptz not null default now()
);
