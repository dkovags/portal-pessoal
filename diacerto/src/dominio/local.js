import { RegraDeNegocioViolada } from './erros.js';

// RF01: endereço e instruções de acesso de cada atendimento. Ficam guardados à parte do
// atendimento e só vão para a profissional depois que ela aceita, até o fim do dia do atendimento.

export const LIMITE_INSTRUCOES = 300;

export function normalizarInstrucoes(texto) {
  const t = String(texto ?? '').trim();
  if (t.length > LIMITE_INSTRUCOES) {
    throw new RegraDeNegocioViolada('INSTRUCOES', `As instruções de acesso vão até ${LIMITE_INSTRUCOES} caracteres.`);
  }
  return t;
}

/** @param {{endereco:string, instrucoes?:string}} d */
export function novoLocal(d) {
  const endereco = String(d.endereco ?? '').trim();
  if (endereco.length < 5) throw new RegraDeNegocioViolada('ENDERECO', 'Informe o endereço do atendimento.');
  return { endereco: endereco.slice(0, 200), instrucoes: normalizarInstrucoes(d.instrucoes) };
}

/** Meia-noite (horário local) do fim do dia do atendimento. @param {Date} inicio */
export function fimDoDia(inicio) {
  return new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 1);
}

/** A profissional vê o local depois de aceitar o pedido e até o fim do dia do atendimento. */
export function localVisivelParaDiarista(a, agora) {
  return ['aceito', 'em_andamento', 'concluido'].includes(a.status) && agora.getTime() < fimDoDia(a.inicio).getTime();
}

/** O cliente muda as instruções enquanto o atendimento não começou. */
export function instrucoesEditaveis(a) {
  return ['solicitado', 'aceito'].includes(a.status);
}
