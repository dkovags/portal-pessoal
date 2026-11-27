import { RegraDeNegocioViolada } from './erros.js';
import { calcularAtendimento } from './precificacao.js';
import { PARAMETROS_PADRAO } from './parametros.js';

// Pacote (RF11): compra explícita e paga de uma vez. O preço de cada atendimento fica travado
// na compra; o dinheiro fica com o provedor e a profissional recebe a cada atendimento concluído.
// O saldo é calculado pelos atendimentos ligados ao pacote, nunca guardado à parte.

export const PRAZO_DESISTENCIA_DIAS = 7; // CDC, art. 49

/**
 * @param {{id:string, clienteId:string, diaristaId:string, duracao:'diaria'|'meiaDiaria', precos:any, metodo:string, agora:Date}} d
 */
export function novoPacote(d, parametros = PARAMETROS_PADRAO) {
  const servico = d.precos[d.duracao];
  if (!servico) throw new RegraDeNegocioViolada('DURACAO', 'Duração inválida para o pacote.');
  const unitario = calcularAtendimento({ servico, transporte: d.precos.transporte, modalidade: 'pacote', descontoPacote: d.precos.descontoPacote }, parametros);
  const validade = new Date(d.agora);
  validade.setMonth(validade.getMonth() + parametros.pacote.validadeMeses);
  return {
    id: d.id, clienteId: d.clienteId, diaristaId: d.diaristaId, duracao: d.duracao, total: parametros.pacote.quantidade,
    unitario, totalPago: unitario.totalCliente * parametros.pacote.quantidade, metodo: d.metodo === 'cartao' ? 'cartao' : 'pix',
    compradoEm: d.agora, validade, status: 'ativo', autorizacao: null, encerradoEm: null, reembolso: 0,
    politicaCancelamento: { ...parametros.cancelamento }, // vale para todos os atendimentos do pacote
  };
}

/** O atendimento gasta uma unidade do pacote? Sim, se está ativo, concluído ou foi cancelado tarde (com taxa). */
export function consomePacote(a) {
  return ['solicitado', 'aceito', 'em_andamento', 'concluido'].includes(a.status) || (a.status === 'cancelado' && (a.taxaCancelamento ?? 0) > 0);
}

/** Situação do pacote a partir dos atendimentos ligados a ele. */
export function situacaoDoPacote(p, atendimentos, agora) {
  const doPacote = atendimentos.filter((a) => a.pacoteId === p.id);
  const usados = doPacote.filter(consomePacote).length;
  const agendados = doPacote.filter((a) => ['solicitado', 'aceito', 'em_andamento'].includes(a.status)).length;
  const realizados = usados - agendados;
  const saldo = Math.max(p.total - usados, 0);
  const vencido = new Date(p.validade).getTime() <= agora.getTime();
  const ativo = p.status === 'ativo';
  return {
    ...p, usados, agendados, realizados, saldo, vencido,
    disponivel: ativo && !vencido && saldo > 0,
    podeEncerrar: ativo && saldo > 0 && agendados === 0,
    desistencia: ativo && realizados === 0 && agora.getTime() - new Date(p.compradoEm).getTime() <= PRAZO_DESISTENCIA_DIAS * 864e5,
    valorReembolsavel: ativo ? saldo * p.unitario.totalCliente : 0,
  };
}

/** Encerra o pacote e devolve o saldo (dentro de 7 dias e sem uso, é a desistência: tudo volta). */
export function encerrarPacote(situacao, agora) {
  if (situacao.status !== 'ativo') throw new RegraDeNegocioViolada('PACOTE_ENCERRADO', 'Este pacote já foi encerrado.');
  if (situacao.agendados > 0) {
    throw new RegraDeNegocioViolada('PACOTE_AGENDADOS', 'Há atendimentos marcados por este pacote. Cancele ou espere concluí-los antes de encerrar.');
  }
  if (situacao.saldo <= 0) throw new RegraDeNegocioViolada('SEM_SALDO', 'Este pacote não tem saldo a devolver.');
  const { usados, agendados, realizados, saldo, vencido, disponivel, podeEncerrar, desistencia, valorReembolsavel, ...pacote } = situacao;
  return { ...pacote, status: 'encerrado', encerradoEm: agora, reembolso: valorReembolsavel };
}
