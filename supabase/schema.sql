create extension if not exists pgcrypto;

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  username text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists app_users_username_lower_unique
  on app_users (lower(username));

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  type text not null check (type in ('Cash', 'Bank', 'Easypaisa', 'Savings', 'Investment', 'Other')),
  balance numeric(14,2) not null default 0 check (balance >= 0),
  month_key text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists accounts_household_name_month_unique
  on accounts (household_id, lower(name), month_key);

create index if not exists accounts_household_month_idx
  on accounts (household_id, month_key);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  color text not null default 'default',
  budget_limit numeric(14,2) not null default 0 check (budget_limit >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists categories_household_name_unique
  on categories (household_id, lower(name));

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  amount numeric(14,2) not null check (amount > 0),
  date date not null,
  account_id uuid not null references accounts(id) on delete restrict,
  category_id uuid not null references categories(id) on delete restrict,
  month_key text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists expenses_household_month_idx
  on expenses (household_id, month_key);

create table if not exists income (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  amount numeric(14,2) not null check (amount > 0),
  date date not null,
  account_id uuid not null references accounts(id) on delete restrict,
  month_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists income_household_month_idx
  on income (household_id, month_key);

create table if not exists hidden_savings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  amount numeric(14,2) not null check (amount > 0),
  date date not null,
  month_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists hidden_savings_household_month_idx
  on hidden_savings (household_id, month_key);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  actor_name text not null,
  actor_username text not null,
  action text not null,
  entity text not null,
  description text not null,
  month_key text,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_household_created_idx
  on activity_logs (household_id, created_at desc);
