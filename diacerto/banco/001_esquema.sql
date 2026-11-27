-- DiaCerto: esquema provisório no banco do projeto Neon "diztudo" (neondb), schema "diacerto".
-- Acesso pela Data API com login Google (Neon Auth). Só e-mails em diacerto.autorizados leem e gravam.
-- Valores monetários em centavos. Datas de atendimento em data local (Brasília) + hora inteira.

create schema if not exists diacerto;

create table diacerto.autorizados (
  email text primary key check (email = lower(email))
);

create or replace function diacerto.autorizado() returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from neon_auth."user" u
    join diacerto.autorizados a on a.email = lower(u.email)
    where u.id::text = auth.user_id() and coalesce(u.banned, false) = false)
$$;

create table diacerto.clientes (
  id text primary key,
  nome text not null,
  endereco text not null,
  regiao text not null
);

create table diacerto.diaristas (
  id text primary key,
  nome text not null,
  iniciais text not null,
  anos_experiencia smallint not null default 0 check (anos_experiencia >= 0),
  regioes text[] not null default '{}',
  tarefas text[] not null default '{}',
  nao_faz text not null default '',
  -- preços definidos pela diarista; pisos espelham src/dominio/parametros.js
  diaria integer not null check (diaria >= 13000),
  meia_diaria integer not null check (meia_diaria >= 7000),
  transporte integer not null default 0 check (transporte >= 0),
  desconto_pacote numeric(4,3) not null default 0 check (desconto_pacote between 0 and 0.30),
  verificacao_data text,
  verificacao_resultado text
);

create table diacerto.disponibilidade (
  diarista_id text not null references diacerto.diaristas(id) on delete cascade,
  data date not null,
  hora_inicio smallint not null,
  hora_fim smallint not null,
  primary key (diarista_id, data),
  check (hora_inicio >= 7 and hora_fim <= 20 and hora_fim > hora_inicio)
);

create table diacerto.avaliacoes (
  id bigint generated always as identity primary key,
  diarista_id text not null references diacerto.diaristas(id) on delete cascade,
  nota numeric(2,1) not null check (nota between 1 and 5),
  texto text not null,
  autor text not null,
  mes text not null
);

create table diacerto.pacotes (
  id text primary key,
  cliente_id text not null references diacerto.clientes(id),
  diarista_id text not null references diacerto.diaristas(id),
  total smallint not null check (total > 0),
  usados smallint not null default 0,
  validade timestamptz not null,
  check (usados between 0 and total)
);

create table diacerto.atendimentos (
  id text primary key,
  cliente_id text not null references diacerto.clientes(id),
  diarista_id text not null references diacerto.diaristas(id),
  data date not null,
  hora_inicio smallint not null,
  hora_fim smallint not null,
  duracao text not null check (duracao in ('diaria', 'meiaDiaria')),
  modalidade text not null check (modalidade in ('avulso', 'pacote')),
  status text not null check (status in ('solicitado', 'aceito', 'recusado', 'em_andamento', 'concluido', 'cancelado')),
  metodo text not null default 'pix' check (metodo in ('pix', 'cartao')),
  observacoes text not null default '' check (length(observacoes) <= 500),
  codigo_confirmacao text not null,
  autorizacao text,
  concluido_em timestamptz,
  servico integer not null check (servico >= 0),
  transporte integer not null check (transporte >= 0),
  taxa_cliente integer not null check (taxa_cliente >= 0),
  cupom integer not null default 0 check (cupom >= 0),
  comissao integer not null check (comissao >= 0),
  total_cliente integer not null,
  recebe_diarista integer not null,
  receita_plataforma integer not null check (receita_plataforma >= 0),
  criado_em timestamptz not null default now(),
  check (hora_inicio >= 7 and hora_fim <= 20 and hora_fim > hora_inicio),
  -- coerência da divisão de valores (a mesma regra de src/dominio/precificacao.js)
  check (total_cliente = servico + transporte + taxa_cliente - cupom),
  check (recebe_diarista = servico - comissao + transporte),
  check (receita_plataforma = comissao + taxa_cliente - cupom)
);
create index on diacerto.atendimentos (cliente_id);
create index on diacerto.atendimentos (diarista_id, data);

create table diacerto.cupons (
  codigo text primary key check (codigo = upper(codigo)),
  valor integer not null check (valor > 0),
  ativo boolean not null default true
);

-- registro do pagamento e das notificações simulados
create table diacerto.eventos (
  id bigint generated always as identity primary key,
  tipo text not null,
  dados jsonb not null default '{}',
  criado_em timestamptz not null default now()
);

-- permissões e RLS: só usuários autorizados, todas as tabelas (protótipo compartilhado)
grant usage on schema diacerto to authenticated;
grant select, insert, update, delete on all tables in schema diacerto to authenticated;
grant usage on all sequences in schema diacerto to authenticated;
revoke all on diacerto.autorizados from authenticated;
grant execute on function diacerto.autorizado() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['clientes','diaristas','disponibilidade','avaliacoes','pacotes','atendimentos','cupons','eventos'] loop
    execute format('alter table diacerto.%I enable row level security', t);
    execute format('create policy %I on diacerto.%I for all to authenticated using (diacerto.autorizado()) with check (diacerto.autorizado())', t || '_autorizados', t);
  end loop;
end $$;
alter table diacerto.autorizados enable row level security;

insert into diacerto.autorizados (email) values ('kovags@gmail.com');
