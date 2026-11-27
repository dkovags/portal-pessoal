-- DiaCerto: cadastro assistido de diaristas.
-- Da verificação só se guarda resultado e data (jsonb), nunca cópias de documentos.
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
  check (status <> 'aprovada' or (diarista_id is not null and aceite_conduta_em is not null))
);
grant select, insert, update, delete on diacerto.candidaturas to authenticated;
alter table diacerto.candidaturas enable row level security;
create policy candidaturas_autorizados on diacerto.candidaturas for all to authenticated
  using (diacerto.autorizado()) with check (diacerto.autorizado());

-- candidaturas fictícias para o protótipo
insert into diacerto.candidaturas (id, nome, celular, status, regioes, criada_em)
  values ('k1', 'Cláudia Ferreira', '61900000001', 'contato', array['Sudoeste'], now() - interval '1 day');
insert into diacerto.candidaturas (id, nome, celular, status, regioes, tarefas, nao_faz, anos_experiencia,
  diaria, meia_diaria, transporte, desconto_pacote, agenda_dias, agenda_inicio, agenda_fim, verificacao, criada_em)
  values ('k2', 'Benedita Souza Lima', '61900000002', 'em_cadastro', array['Asa Sul','Sudoeste'],
  array['Limpeza geral','Cozinha','Passar roupas leves'], 'Áreas em altura.', 15, 19000, 10500, 1800, 0.1,
  array[1,3,5]::smallint[], 8, 17,
  jsonb_build_object(
    'identidade', jsonb_build_object('resultado','ok','data', to_char(current_date - 2, 'YYYY-MM-DD')),
    'certidao_pcdf', jsonb_build_object('resultado','ok','data', to_char(current_date - 2, 'YYYY-MM-DD')),
    'certidao_pf', jsonb_build_object('resultado','ok','data', to_char(current_date - 2, 'YYYY-MM-DD')),
    'referencia_1', jsonb_build_object('resultado','ok','data', to_char(current_date - 2, 'YYYY-MM-DD')),
    'referencia_2', jsonb_build_object('resultado','pendente','data', null),
    'conversa', jsonb_build_object('resultado','pendente','data', null)),
  now() - interval '3 days');
