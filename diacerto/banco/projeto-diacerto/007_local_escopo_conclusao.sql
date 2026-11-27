-- RF01 (endereço só depois do aceite), RF02 (imóvel e escopo do pedido) e RF03 (conclusão com
-- prazo para contestar). Só acrescenta colunas, tabelas e regras; nenhum dado é apagado.

-- RF01: endereço e instruções de acesso de cada atendimento, guardados à parte
create table if not exists diacerto.locais_atendimento (
  atendimento_id text primary key references diacerto.atendimentos(id),
  endereco text not null check (length(endereco) between 5 and 200),
  instrucoes text not null default '' check (length(instrucoes) <= 300),
  atualizado_em timestamptz not null default now()
);

-- os atendimentos que já existem ficam com o endereço do cadastro do cliente
insert into diacerto.locais_atendimento (atendimento_id, endereco)
  select a.id, c.endereco from diacerto.atendimentos a join diacerto.clientes c on c.id = a.cliente_id
  where length(c.endereco) between 5 and 200
  on conflict (atendimento_id) do nothing;

-- RF02: imóvel lembrado no cliente; escopo e materiais no pedido; profissional diz se leva produtos
alter table diacerto.clientes add column if not exists imovel jsonb;
alter table diacerto.diaristas add column if not exists leva_materiais boolean not null default false;

-- RF02 e RF03 no atendimento
alter table diacerto.atendimentos
  add column if not exists imovel jsonb,
  add column if not exists tarefas text[] not null default '{}',
  add column if not exists materiais text not null default 'cliente' check (materiais in ('cliente', 'profissional')),
  add column if not exists repasse_status text check (repasse_status in ('aguardando', 'liberado', 'contestado', 'retido')),
  add column if not exists repasse_liberar_em timestamptz,
  add column if not exists repasse_decidido_em timestamptz,
  add column if not exists repasse_origem text check (repasse_origem in ('cliente', 'prazo', 'operacao'));

-- RF03: o que já foi concluído teve o repasse feito na conclusão
update diacerto.atendimentos
  set repasse_status = 'liberado',
      repasse_liberar_em = coalesce(concluido_em, data::timestamptz),
      repasse_decidido_em = coalesce(concluido_em, data::timestamptz)
  where status = 'concluido' and repasse_status is null;

alter table diacerto.atendimentos
  add constraint atendimentos_repasse_check check ((status = 'concluido') = (repasse_status is not null)
    and (repasse_status is null or repasse_liberar_em is not null)
    and (repasse_status not in ('liberado', 'retido') or repasse_decidido_em is not null));

-- RF03: ocorrência aberta pelo cliente no prazo de confirmar a conclusão segura o repasse
alter table diacerto.ocorrencias add column if not exists contestacao boolean not null default false;
