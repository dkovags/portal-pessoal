import { RegraDeNegocioViolada } from './erros.js';

// Perfis de acesso: cada e-mail (conta Google) tem um papel.
// Diaristas são profissionais autônomas cadastradas, não empregadas da plataforma.
export const PAPEIS = Object.freeze({ operacao: 'Operação', cliente: 'Cliente', diarista: 'Diarista' });

export function normalizarEmail(email) {
  const e = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw new RegraDeNegocioViolada('EMAIL', 'Informe um e-mail válido (a conta Google da pessoa).');
  return e;
}

/** @param {{email:string, papel:string, clienteId?:string|null, diaristaId?:string|null}} p */
export function novoPerfil(p) {
  if (!PAPEIS[p.papel]) throw new RegraDeNegocioViolada('PAPEL', 'Papel inválido.');
  if (p.papel === 'cliente' && !p.clienteId) throw new RegraDeNegocioViolada('CLIENTE', 'Perfil de cliente precisa do cadastro do cliente.');
  if (p.papel === 'diarista' && !p.diaristaId) throw new RegraDeNegocioViolada('DIARISTA', 'Perfil de diarista precisa do perfil da profissional.');
  return { email: normalizarEmail(p.email), papel: p.papel,
    clienteId: p.papel === 'cliente' ? p.clienteId : null, diaristaId: p.papel === 'diarista' ? p.diaristaId : null };
}

export function normalizarCelular(celular) {
  const c = String(celular ?? '').replace(/\D/g, '');
  if (!/^\d{10,11}$/.test(c)) throw new RegraDeNegocioViolada('CELULAR', 'Informe o celular com DDD.');
  return c;
}

/** @param {{nome:string, endereco:string, regiao:string, celular?:string|null}} d */
export function novoCliente(d) {
  const nome = String(d.nome ?? '').trim();
  const endereco = String(d.endereco ?? '').trim();
  const regiao = String(d.regiao ?? '').trim();
  if (nome.length < 3) throw new RegraDeNegocioViolada('NOME', 'Informe o nome do cliente.');
  if (endereco.length < 5) throw new RegraDeNegocioViolada('ENDERECO', 'Informe o endereço (quadra, bloco e apartamento).');
  if (!regiao) throw new RegraDeNegocioViolada('REGIAO', 'Informe a região.');
  return { id: d.id, nome: nome.slice(0, 120), endereco: endereco.slice(0, 200), regiao, celular: d.celular ? normalizarCelular(d.celular) : null };
}
