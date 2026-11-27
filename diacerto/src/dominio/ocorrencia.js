import { RegraDeNegocioViolada } from './erros.js';
import { reais } from './dinheiro.js';

// Ocorrências de atendimento e reembolsos. A apuração ouve as duas partes;
// nada é descontado da diarista automaticamente.

export const TIPOS_OCORRENCIA = Object.freeze({
  dano: 'Dano material',
  falta_diarista: 'Falta da profissional',
  atraso: 'Atraso',
  qualidade: 'Qualidade do serviço',
  seguranca: 'Assédio ou risco no local',
  acidente: 'Acidente',
  outro: 'Outro',
});
export const GRAVIDADES = Object.freeze({ leve: 'Leve', moderada: 'Moderada', grave: 'Grave' });
export const ABERTO_POR = Object.freeze({ cliente: 'Cliente', diarista: 'Profissional', operacao: 'Operação' });

export const POLITICA_REEMBOLSO = Object.freeze({ limiteDano: reais(500), prazoGraveHoras: 72 });

/** @param {{id:string, atendimentoId:string, tipo:string, gravidade:string, abertoPor:string, descricao:string, abertaEm:Date}} d */
export function novaOcorrencia(d) {
  if (!TIPOS_OCORRENCIA[d.tipo]) throw new RegraDeNegocioViolada('TIPO', 'Tipo de ocorrência inválido.');
  if (!GRAVIDADES[d.gravidade]) throw new RegraDeNegocioViolada('GRAVIDADE', 'Gravidade inválida.');
  if (!ABERTO_POR[d.abertoPor]) throw new RegraDeNegocioViolada('ORIGEM', 'Informe quem relatou.');
  const descricao = String(d.descricao ?? '').trim();
  if (descricao.length < 10) throw new RegraDeNegocioViolada('DESCRICAO', 'Descreva o que aconteceu (ao menos 10 caracteres).');
  // risco à segurança e acidentes são sempre graves
  const gravidade = ['seguranca', 'acidente'].includes(d.tipo) ? 'grave' : d.gravidade;
  return { id: d.id, atendimentoId: d.atendimentoId, tipo: d.tipo, gravidade, abertoPor: d.abertoPor,
    descricao: descricao.slice(0, 1000), status: 'aberta', abertaEm: d.abertaEm, resolvidaEm: null, resolucao: '', reembolso: 0 };
}

/**
 * Encerra a ocorrência. Reembolso só em dano (até o limite da política) ou falta da profissional (até o valor pago).
 * @param {ReturnType<typeof novaOcorrencia>} o @param {{resolucao:string, reembolso:number, totalPago:number, agora:Date}} r
 */
export function resolverOcorrencia(o, r) {
  if (o.status !== 'aberta') throw new RegraDeNegocioViolada('JA_RESOLVIDA', 'Esta ocorrência já foi resolvida.');
  const resolucao = String(r.resolucao ?? '').trim();
  if (resolucao.length < 10) throw new RegraDeNegocioViolada('RESOLUCAO', 'Registre como foi resolvida, depois de ouvir as duas partes.');
  const reembolso = Math.round(Number(r.reembolso) || 0);
  if (reembolso < 0) throw new RegraDeNegocioViolada('REEMBOLSO', 'Reembolso inválido.');
  if (reembolso > 0) {
    if (o.tipo === 'dano' && reembolso > POLITICA_REEMBOLSO.limiteDano) {
      throw new RegraDeNegocioViolada('LIMITE_REEMBOLSO', 'A Política de Reembolso cobre danos de até R$ 500,00 por ocorrência.');
    }
    if (o.tipo === 'falta_diarista' && reembolso > r.totalPago) {
      throw new RegraDeNegocioViolada('LIMITE_REEMBOLSO', 'O reembolso por falta não pode passar do valor pago.');
    }
    if (!['dano', 'falta_diarista'].includes(o.tipo)) {
      throw new RegraDeNegocioViolada('SEM_REEMBOLSO', 'Reembolso só para dano material ou falta da profissional.');
    }
  }
  return { ...o, status: 'resolvida', resolucao: resolucao.slice(0, 1000), reembolso, resolvidaEm: r.agora };
}
