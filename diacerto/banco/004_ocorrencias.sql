-- DiaCerto: ocorrências de atendimento e reembolsos (painel da operação).
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
  check (tipo <> 'dano' or reembolso <= 50000), -- Política de Reembolso: até R$ 500 por dano
  check (reembolso = 0 or tipo in ('dano', 'falta_diarista')),
  check (status = 'aberta' or (resolvida_em is not null and length(resolucao) >= 10))
);
create index on diacerto.ocorrencias (atendimento_id);
grant select, insert, update, delete on diacerto.ocorrencias to authenticated;
alter table diacerto.ocorrencias enable row level security;
create policy ocorrencias_autorizados on diacerto.ocorrencias for all to authenticated
  using (diacerto.autorizado()) with check (diacerto.autorizado());

-- dados fictícios: um cancelamento e duas ocorrências
insert into diacerto.atendimentos (id, cliente_id, diarista_id, data, hora_inicio, hora_fim, duracao, modalidade, status, metodo,
  observacoes, codigo_confirmacao, servico, transporte, taxa_cliente, cupom, comissao, total_cliente, recebe_diarista, receita_plataforma)
  values ('a9', 'c3', 'd2', current_date - 5, 8, 17, 'diaria', 'avulso', 'cancelado', 'pix', '', '4821',
  19000, 2000, 1500, 0, 3800, 22500, 17200, 5300);
insert into diacerto.ocorrencias (id, atendimento_id, tipo, gravidade, aberto_por, descricao, status, aberta_em)
  values ('o1', 'a6', 'dano', 'moderada', 'cliente',
  'Um vaso de vidro da sala trincou durante a limpeza. A cliente enviou foto pelo WhatsApp.', 'aberta', now() - interval '26 hours');
insert into diacerto.ocorrencias (id, atendimento_id, tipo, gravidade, aberto_por, descricao, status, aberta_em, resolvida_em, resolucao)
  values ('o2', 'a3', 'atraso', 'leve', 'cliente',
  'A profissional chegou 40 minutos depois do combinado por problema no ônibus.', 'resolvida', now() - interval '14 days', now() - interval '13 days',
  'Conversamos com as duas partes; a profissional avisou do atraso e compensou o horário no fim.');
