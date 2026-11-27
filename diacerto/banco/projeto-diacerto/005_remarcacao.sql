-- Remarcação pelo cliente: no máximo uma por atendimento.
alter table diacerto.atendimentos add column if not exists remarcacoes smallint not null default 0 check (remarcacoes between 0 and 1);
