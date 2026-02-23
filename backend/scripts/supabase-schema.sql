-- Rifatela schema for Supabase/Postgres
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  email text,
  password text not null,
  role text not null default 'seller' check (role in ('admin', 'seller')),
  created_at timestamptz not null default now()
);

create table if not exists public.raffles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  prize text,
  price_per_ticket integer not null default 40000,
  total_tickets integer not null default 10000,
  tickets_sold integer not null default 0,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  winner jsonb,
  draw_date timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.raffle_participants (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references public.raffles(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  ticket_number integer not null check (ticket_number >= 0 and ticket_number <= 9999),
  code text not null unique,
  bought_at timestamptz not null default now(),
  payment_method text not null default 'WhatsApp',
  registered_by text not null default 'public'
);

create unique index if not exists raffle_participants_raffle_ticket_unique
  on public.raffle_participants (raffle_id, ticket_number);

create index if not exists raffle_participants_raffle_id_idx
  on public.raffle_participants (raffle_id);

create index if not exists raffle_participants_bought_at_idx
  on public.raffle_participants (bought_at desc);

create table if not exists public.saved_tickets (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  ticket_number integer not null,
  raffle_title text not null,
  raffle_id uuid not null references public.raffles(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  bought_at timestamptz not null,
  saved_at timestamptz not null default now(),
  user_secret uuid not null
);

create unique index if not exists saved_tickets_user_secret_code_unique
  on public.saved_tickets (user_secret, code);

create index if not exists saved_tickets_user_secret_idx
  on public.saved_tickets (user_secret);
