-- E-mail (conta Google) da candidata: na aprovação, vira o acesso da diarista.
alter table diacerto.candidaturas add column if not exists email text check (email = lower(email));
