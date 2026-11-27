import { percentualDe } from './dinheiro.js';
import { RegraDeNegocioViolada } from './erros.js';
import { PARAMETROS_PADRAO } from './parametros.js';

/** Segunda-feira (00h, horário local) da semana da data informada. @param {Date} data */
export function inicioDaSemana(data) {
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const deslocamento = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - deslocamento);
  return d;
}

/**
 * A mesma diarista atende o mesmo cliente no máximo N vezes por semana.
 * Limite operacional; não resolve sozinho o enquadramento da LC 150.
 * @param {Date} data @param {Date[]} datasJaAgendadas da mesma dupla, atendimentos ativos
 */
export function verificarLimiteSemanal(data, datasJaAgendadas, parametros = PARAMETROS_PADRAO) {
  const semana = inicioDaSemana(data).getTime();
  const naSemana = datasJaAgendadas.filter((d) => inicioDaSemana(d).getTime() === semana).length;
  if (naSemana >= parametros.limiteSemanalMesmoCliente) {
    throw new RegraDeNegocioViolada('LIMITE_SEMANAL',
      `A mesma profissional pode atender você até ${parametros.limiteSemanalMesmoCliente} vezes por semana.`);
  }
  return true;
}

/** Horário dentro da janela de funcionamento da plataforma. @param {number} inicio @param {number} fim horas */
export function verificarJanela(inicio, fim, parametros = PARAMETROS_PADRAO) {
  if (inicio < parametros.janela.inicio || fim > parametros.janela.fim || fim <= inicio) {
    throw new RegraDeNegocioViolada('FORA_DA_JANELA',
      `Atendimentos acontecem entre ${parametros.janela.inicio}h e ${parametros.janela.fim}h.`);
  }
  return true;
}

/**
 * Política de cancelamento pelo cliente.
 * @param {{inicio:Date, totalCliente:number, recebeDiarista:number}} atendimento
 * @param {Date} agora
 */
export function calcularCancelamentoPeloCliente(atendimento, agora, parametros = PARAMETROS_PADRAO) {
  const horas = (atendimento.inicio.getTime() - agora.getTime()) / 36e5;
  if (horas >= parametros.cancelamento.horasGratuitas) {
    return { gratuito: true, reembolsoCliente: atendimento.totalCliente, devidoDiarista: 0 };
  }
  const devidoDiarista = percentualDe(atendimento.recebeDiarista, parametros.cancelamento.percentualDevidoDiarista);
  return { gratuito: false, reembolsoCliente: atendimento.totalCliente - devidoDiarista, devidoDiarista };
}
