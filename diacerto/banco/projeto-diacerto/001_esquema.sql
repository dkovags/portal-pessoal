-- DiaCerto: esquema do projeto Neon próprio ("diacerto", AWS us-east-1).
-- O navegador não acessa o banco: todas as leituras e gravações passam pela função
-- "api" (Neon Functions), que roda as camadas de domínio e aplicação e decide o que
-- cada perfil pode fazer. Valores em centavos; datas de atendimento em data local + hora.

create schema if not exists diacerto;

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

create table diacerto.eventos (
  id bigint generated always as identity primary key,
  tipo text not null,
  dados jsonb not null default '{}',
  criado_em timestamptz not null default now()
);

create table diacerto.candidaturas (
  id text primary key,
  nome text not null check (length(nome) >= 3),
  celular text not null check (celular ~ '^\d{10,11}$'),
  status text not null check (status in ('contato', 'em_cadastro', 'aprovada', 'reprovada')),
  regioes text[] not null default '{}',
  tarefas text[] not null default '{}',
  nao_faz text not null default '',
  anos_experiencia smallint not null default 0 check (anos_experiencia >= 0),
  diaria integer not null default 0 check (diaria >= 0),
  meia_diaria integer not null default 0 check (meia_diaria >= 0),
  transporte integer not null default 0 check (transporte >= 0),
  desconto_pacote numeric(4,3) not null default 0 check (desconto_pacote between 0 and 0.30),
  agenda_dias smallint[] not null default '{}',
  agenda_inicio smallint not null default 8,
  agenda_fim smallint not null default 17,
  verificacao jsonb not null default '{}',
  aceite_conduta_em timestamptz,
  motivo_reprovacao text not null default '' check (length(motivo_reprovacao) <= 300),
  diarista_id text references diacerto.diaristas(id),
  criada_em timestamptz not null default now(),
  email text check (email = lower(email)),
  check (status <> 'aprovada' or (diarista_id is not null and aceite_conduta_em is not null))
);

create table diacerto.ocorrencias (
  id text primary key,
  atendimento_id text not null references diacerto.atendimentos(id),
  tipo text not null check (tipo in ('dano', 'falta_diarista', 'atraso', 'qualidade', 'seguranca', 'acidente', 'outro')),
  gravidade text not null check (gravidade in ('leve', 'moderada', 'grave')),
  aberto_por text not null check (aberto_por in ('cliente', 'diarista', 'operacao')),
  descricao text not null check (length(descricao) between 10 and 1000),
  status text not null check (status in ('aberta', 'resolvida')),
  aberta_em timestamptz not null default now(),
  resolvida_em timestamptz,
  resolucao text not null default '' check (length(resolucao) <= 1000),
  reembolso integer not null default 0 check (reembolso >= 0),
  check (tipo not in ('seguranca', 'acidente') or gravidade = 'grave'),
  check (tipo <> 'dano' or reembolso <= 50000),
  check (reembolso = 0 or tipo in ('dano', 'falta_diarista')),
  check (status = 'aberta' or (resolvida_em is not null and length(resolucao) >= 10))
);

create index on diacerto.ocorrencias (atendimento_id);

create table diacerto.perfis (
  email text primary key check (email = lower(email)),
  papel text not null check (papel in ('operacao', 'cliente', 'diarista')),
  cliente_id text references diacerto.clientes(id),
  diarista_id text references diacerto.diaristas(id),
  criado_em timestamptz not null default now(),
  check (papel <> 'cliente' or cliente_id is not null),
  check (papel <> 'diarista' or diarista_id is not null)
);

insert into diacerto.perfis (email, papel) values ('kovags@gmail.com', 'operacao');
