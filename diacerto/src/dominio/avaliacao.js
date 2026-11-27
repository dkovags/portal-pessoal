import { RegraDeNegocioViolada } from './erros.js';

// Avaliação depois do atendimento: o cliente avalia a profissional (aparece no perfil dela)
// e a profissional avalia o cliente (uso interno da operação). Uma por lado, só de
// atendimento concluído e até 30 dias depois.

export const PRAZO_AVALIACAO_DIAS = 30;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * @param {{atendimento:{id:string, status:string, concluidoEm?:Date, inicio:Date}, lado:'cliente'|'diarista',
 *   nota:number, comentario?:string, agora:Date, jaAvaliado:boolean}} d
 */
export function novaAvaliacao(d) {
  if (d.atendimento.status !== 'concluido') throw new RegraDeNegocioViolada('NAO_CONCLUIDO', 'Só dá para avaliar depois que o atendimento termina.');
  if (d.jaAvaliado) throw new RegraDeNegocioViolada('JA_AVALIADO', 'Este atendimento já foi avaliado.');
  const fim = new Date(d.atendimento.concluidoEm ?? d.atendimento.inicio).getTime();
  if (d.agora.getTime() - fim > PRAZO_AVALIACAO_DIAS * 864e5) {
    throw new RegraDeNegocioViolada('PRAZO_AVALIACAO', `A avaliação pode ser feita até ${PRAZO_AVALIACAO_DIAS} dias depois do atendimento.`);
  }
  const nota = Number(d.nota);
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) throw new RegraDeNegocioViolada('NOTA', 'Escolha uma nota de 1 a 5.');
  const comentario = String(d.comentario ?? '').trim().slice(0, 300);
  return { atendimentoId: d.atendimento.id, lado: d.lado, nota, comentario, criadaEm: d.agora };
}

/** Texto público da avaliação no perfil da profissional (sem identificar o cliente). */
export function avaliacaoPublica(av, cliente) {
  const quando = new Date(av.criadaEm);
  return { nota: av.nota, texto: av.comentario, autor: `Cliente ${cliente?.regiao ? `da região ${cliente.regiao}` : 'do DiaCerto'}`, mes: `${MESES[quando.getMonth()]}/${quando.getFullYear()}` };
}
