-- Avaliações depois do atendimento: do cliente (pública, no perfil da profissional)
-- e da profissional sobre o cliente (interna). Uma por lado por atendimento.
alter table diacerto.avaliacoes add column if not exists atendimento_id text unique references diacerto.atendimentos(id);
alter table diacerto.avaliacoes add column if not exists criada_em timestamptz not null default now();
alter table diacerto.avaliacoes add constraint avaliacoes_texto_tamanho check (length(texto) <= 300);
create table if not exists diacerto.avaliacoes_cliente (
  atendimento_id text primary key references diacerto.atendimentos(id),
  cliente_id text not null references diacerto.clientes(id),
  nota smallint not null check (nota between 1 and 5),
  comentario text not null default '' check (length(comentario) <= 300),
  criada_em timestamptz not null default now()
);
