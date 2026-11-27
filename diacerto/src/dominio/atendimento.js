import { RegraDeNegocioViolada } from './erros.js';

// Ciclo de vida de um atendimento. A confirmação por código só libera o
// pagamento e registra a ocorrência; não mede jornada nem gera penalidade.
export const STATUS = Object.freeze({
  SOLICITADO: 'solicitado',
  ACEITO: 'aceito',
  RECUSADO: 'recusado',
  EM_ANDAMENTO: 'em_andamento',
  CONCLUIDO: 'concluido',
  CANCELADO: 'cancelado',
});

const TRANSICOES = {
  [STATUS.SOLICITADO]: [STATUS.ACEITO, STATUS.RECUSADO, STATUS.CANCELADO],
  [STATUS.ACEITO]: [STATUS.EM_ANDAMENTO, STATUS.CANCELADO],
  [STATUS.EM_ANDAMENTO]: [STATUS.CONCLUIDO],
  [STATUS.RECUSADO]: [],
  [STATUS.CONCLUIDO]: [],
  [STATUS.CANCELADO]: [],
};

export const STATUS_ATIVOS = [STATUS.SOLICITADO, STATUS.ACEITO, STATUS.EM_ANDAMENTO, STATUS.CONCLUIDO];

/**
 * @typedef {object} Atendimento
 * @property {string} id @property {string} clienteId @property {string} diaristaId
 * @property {Date} inicio @property {number} horaInicio @property {number} horaFim
 * @property {'avulso'|'pacote'} modalidade @property {string} status
 * @property {ReturnType<import('./precificacao.js').calcularAtendimento>} valores
 * @property {string} observacoes @property {string} codigoConfirmacao
 */

/** @param {Omit<Atendimento,'status'>} dados @returns {Atendimento} */
export function novoAtendimento(dados) {
  return { ...dados, status: STATUS.SOLICITADO };
}

/** @param {Atendimento} atendimento @param {string} novo @returns {Atendimento} */
export function mudarStatus(atendimento, novo) {
  if (!TRANSICOES[atendimento.status]?.includes(novo)) {
    throw new RegraDeNegocioViolada('TRANSICAO_INVALIDA',
      `Não é possível passar de "${atendimento.status}" para "${novo}".`);
  }
  return { ...atendimento, status: novo };
}

/** Confirmação de chegada: o código vem do cliente. @param {Atendimento} atendimento @param {string} codigo */
export function confirmarChegada(atendimento, codigo) {
  if (codigo !== atendimento.codigoConfirmacao) {
    throw new RegraDeNegocioViolada('CODIGO_INVALIDO', 'Código não confere. Peça o código ao cliente ou use "não consegui confirmar".');
  }
  return mudarStatus(atendimento, STATUS.EM_ANDAMENTO);
}
