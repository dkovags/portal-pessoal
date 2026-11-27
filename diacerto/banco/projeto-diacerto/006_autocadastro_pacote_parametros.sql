-- RF14 (autocadastro e aceites), RF11 (pacote completo) e RF7 (parâmetros com vigência).
-- Só acrescenta colunas, tabelas e regras; nenhum dado é apagado. A coluna pacotes.usados
-- deixa de ser usada (o saldo sai dos atendimentos), mas continua no banco.

-- RF14: celular do cliente e aceite dos documentos, por versão
alter table diacerto.clientes
  add column if not exists celular text check (celular ~ '^\d{10,11}$'),
  add column if not exists criado_em timestamptz not null default now();

create table if not exists diacerto.aceites (
  email text not null check (email = lower(email)),
  documento text not null check (documento in ('termos-cliente', 'termos-profissional', 'privacidade')),
  versao text not null,
  aceito_em timestamptz not null default now(),
  primary key (email, documento, versao)
);

-- RF11: o pacote guarda o preço travado na compra; o atendimento sabe de qual pacote saiu
alter table diacerto.pacotes
  add column if not exists duracao text not null default 'diaria' check (duracao in ('diaria', 'meiaDiaria')),
  add column if not exists servico integer,
  add column if not exists transporte integer,
  add column if not exists taxa_cliente integer,
  add column if not exists comissao integer,
  add column if not exists total_unitario integer,
  add column if not exists recebe_diarista integer,
  add column if not exists receita_plataforma integer,
  add column if not exists total_pago integer,
  add column if not exists metodo text not null default 'pix' check (metodo in ('pix', 'cartao')),
  add column if not exists autorizacao text,
  add column if not exists comprado_em timestamptz,
  add column if not exists status text not null default 'ativo' check (status in ('ativo', 'encerrado')),
  add column if not exists encerrado_em timestamptz,
  add column if not exists reembolso integer not null default 0 check (reembolso >= 0),
  add column if not exists politica_cancelamento jsonb;

alter table diacerto.atendimentos
  add column if not exists pacote_id text references diacerto.pacotes(id),
  add column if not exists taxa_cancelamento integer not null default 0 check (taxa_cancelamento >= 0),
  add column if not exists politica_cancelamento jsonb;

-- liga os atendimentos já feitos por pacote ao pacote da mesma dupla
update diacerto.atendimentos a set pacote_id = p.id
  from diacerto.pacotes p
  where a.modalidade = 'pacote' and a.pacote_id is null and p.cliente_id = a.cliente_id and p.diarista_id = a.diarista_id;

-- preço travado = o do primeiro atendimento feito pelo pacote; compra = véspera desse atendimento
update diacerto.pacotes p set
  duracao = a.duracao, servico = a.servico, transporte = a.transporte, taxa_cliente = a.taxa_cliente, comissao = a.comissao,
  total_unitario = a.servico + a.transporte + a.taxa_cliente, recebe_diarista = a.recebe_diarista,
  receita_plataforma = a.comissao + a.taxa_cliente, total_pago = (a.servico + a.transporte + a.taxa_cliente) * p.total,
  metodo = a.metodo, autorizacao = coalesce(p.autorizacao, 'sim-hist-' || p.id),
  comprado_em = coalesce(p.comprado_em, (a.data - 1)::timestamptz)
  from (select distinct on (pacote_id) * from diacerto.atendimentos where pacote_id is not null order by pacote_id, data) a
  where a.pacote_id = p.id and p.servico is null;

-- política de cancelamento em vigor até aqui, gravada no que já foi contratado
update diacerto.atendimentos set politica_cancelamento = '{"horasGratuitas":24,"percentualDevidoDiarista":0.5}' where politica_cancelamento is null;
update diacerto.pacotes set politica_cancelamento = '{"horasGratuitas":24,"percentualDevidoDiarista":0.5}' where politica_cancelamento is null;

-- se algum pacote antigo ficou sem atendimento para servir de base, os comandos abaixo falham e nada é aplicado
alter table diacerto.pacotes
  alter column servico set not null, alter column transporte set not null, alter column taxa_cliente set not null,
  alter column comissao set not null, alter column total_unitario set not null, alter column recebe_diarista set not null,
  alter column receita_plataforma set not null, alter column total_pago set not null,
  alter column comprado_em set not null, alter column comprado_em set default now();

alter table diacerto.pacotes
  add constraint pacotes_valores_check check (servico >= 0 and transporte >= 0 and taxa_cliente >= 0 and comissao >= 0
    and total_unitario = servico + transporte + taxa_cliente and recebe_diarista = servico - comissao + transporte
    and receita_plataforma = comissao + taxa_cliente and total_pago = total_unitario * total and reembolso <= total_pago),
  add constraint pacotes_encerramento_check check (status = 'ativo' or encerrado_em is not null);

alter table diacerto.atendimentos
  add constraint atendimentos_pacote_check check ((modalidade = 'pacote') = (pacote_id is not null));

create index if not exists pacotes_cliente_id_idx on diacerto.pacotes (cliente_id);
create index if not exists atendimentos_pacote_id_idx on diacerto.atendimentos (pacote_id);

-- RF7: parâmetros comerciais com vigência
create table if not exists diacerto.parametros (
  id bigint generated always as identity primary key,
  vigente_desde timestamptz not null default now(),
  valores jsonb not null,
  motivo text not null check (length(motivo) between 10 and 500),
  alterado_por text not null
);

insert into diacerto.parametros (valores, motivo, alterado_por)
  select '{"comissao":{"avulso":0.2,"pacote":0.15},"taxaCliente":{"avulso":1500,"pacote":1200},"piso":{"diaria":13000,"meiaDiaria":7000},"cancelamento":{"horasGratuitas":24,"percentualDevidoDiarista":0.5},"pacote":{"quantidade":4,"descontoMaximo":0.3,"validadeMeses":3}}',
    'Valores iniciais do piloto (documento de análise crítica).', 'sistema'
  where not exists (select 1 from diacerto.parametros);

-- o piso vira parâmetro da operação: o banco passa a guardar só um mínimo absoluto
alter table diacerto.diaristas drop constraint if exists diaristas_diaria_check;
alter table diacerto.diaristas add constraint diaristas_diaria_check check (diaria >= 5000);
alter table diacerto.diaristas drop constraint if exists diaristas_meia_diaria_check;
alter table diacerto.diaristas add constraint diaristas_meia_diaria_check check (meia_diaria >= 3000);
