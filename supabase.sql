-- Santa Cruz Acessível — Supabase SQL
-- Execute no SQL Editor do seu projeto Supabase.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  role text not null default 'user' check (role in ('user','prefeitura','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  type text not null,
  priority text not null check (priority in ('Baixa','Média','Alta')),
  status text not null default 'Pendente' check (status in ('Pendente','Em análise','Em andamento','Resolvido','Rejeitado')),
  progress integer not null default 0 check (progress between 0 and 100),
  address text,
  latitude double precision not null,
  longitude double precision not null,
  photo_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  nome text,
  mensagem text not null,
  avaliação integer not null check (avaliação between 1 and 5),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "Public can read reports" on public.reports;
create policy "Public can read reports" on public.reports for select using (true);

drop policy if exists "Anyone can create reports" on public.reports;
create policy "Anyone can create reports" on public.reports for insert with check (created_by is null or created_by = auth.uid());

drop policy if exists "Staff can update reports" on public.reports;
create policy "Staff can update reports" on public.reports for update using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('prefeitura','admin'))
) with check (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('prefeitura','admin'))
);

drop policy if exists "Public can create feedback" on public.feedback;
create policy "Public can create feedback" on public.feedback for insert with check (true);

drop policy if exists "Staff can read feedback" on public.feedback;
create policy "Staff can read feedback" on public.feedback for select using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('prefeitura','admin'))
);

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select using (id=auth.uid());

-- Cria perfil automaticamente quando um usuário do Auth é criado.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,nome,email,role)
  values(new.id, coalesce(new.raw_user_meta_data->>'nome',''), new.email, 'user');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Storage para fotos. O bucket é público para exibição das fotos aprovadas.
insert into storage.buckets (id,name,public)
values ('report-photos','report-photos',true)
on conflict (id) do update set public=true;

drop policy if exists "Public can upload report photos" on storage.objects;
create policy "Public can upload report photos" on storage.objects
for insert with check (bucket_id='report-photos');

drop policy if exists "Public can view report photos" on storage.objects;
create policy "Public can view report photos" on storage.objects
for select using (bucket_id='report-photos');

-- DADOS FICTÍCIOS DE DEMONSTRAÇÃO
insert into public.reports(title,description,type,priority,status,progress,address,latitude,longitude)
values
('Calçada quebrada perto da praça','Trecho irregular dificulta a passagem de cadeiras de rodas e carrinhos.','calçada','Alta','Em andamento',75,'Praça Deputado Leônidas Camarinha',-22.8988,-49.6332),
('Faixa de pedestres precisa de manutenção','Sinalização desgastada em uma travessia movimentada.','travessia','Média','Em análise',25,'Av. Tiradentes',-22.8970,-49.6300),
('Rampa de acesso funcionando','Ponto positivo de acessibilidade.','ponto positivo','Baixa','Resolvido',100,'Centro',-22.9000,-49.6345),
('Obstáculo na calçada','Objeto bloqueando parcialmente a passagem.','obstáculo','Alta','Pendente',0,'Rua Conselheiro Dantas',-22.8956,-49.6351),
('Piso tátil incompleto','Trecho de orientação tátil precisa ser complementado.','acessibilidade','Média','Em andamento',50,'Rua Catarina Etsuko Umezu',-22.9011,-49.6295);
