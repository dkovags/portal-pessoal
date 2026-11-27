import { percentualDe, formatarReais } from './dinheiro.js';
import { RegraDeNegocioViolada } from './erros.js';
import { PARAMETROS_PADRAO } from './parametros.js';

/** @typedef {'avulso'|'pacote'} Modalidade */
/** @typedef {'diaria'|'meiaDiaria'} Duracao */

/**
 * Valida os preços definidos pela diarista contra o piso e o desconto máximo do pacote.
 * @param {{diaria:number, meiaDiaria:number, transporte:number, descontoPacote:number}} precos
 */
export function validarPrecosDaDiarista(precos, parametros = PARAMETROS_PADRAO) {
  if (precos.diaria < parametros.piso.diaria) {
    throw new RegraDeNegocioViolada('PISO_DIARIA', `A diária está abaixo da remuneração mínima (${formatarReais(parametros.piso.diaria)}).`);
  }
  if (precos.meiaDiaria < parametros.piso.meiaDiaria) {
    throw new RegraDeNegocioViolada('PISO_MEIA_DIARIA', `A meia diária está abaixo da remuneração mínima (${formatarReais(parametros.piso.meiaDiaria)}).`);
  }
  if (precos.transporte < 0) {
    throw new RegraDeNegocioViolada('TRANSPORTE_NEGATIVO', 'O transporte não pode ser negativo.');
  }
  if (precos.descontoPacote < 0 || precos.descontoPacote > parametros.pacote.descontoMaximo) {
    throw new RegraDeNegocioViolada('DESCONTO_PACOTE', `O desconto do pacote vai de 0% a ${Math.round(parametros.pacote.descontoMaximo * 100)}%.`);
  }
  return true;
}

/**
 * Calcula a divisão de um atendimento entre cliente, diarista e plataforma.
 * A comissão incide só sobre o serviço (nunca sobre o transporte).
 * O cupom é custeado pela plataforma e nunca reduz o que a diarista recebe.
 * @param {{servico:number, transporte:number, modalidade:Modalidade, descontoPacote?:number, cupom?:number}} entrada
 */
export function calcularAtendimento(entrada, parametros = PARAMETROS_PADRAO) {
  const { transporte, modalidade } = entrada;
  if (modalidade !== 'avulso' && modalidade !== 'pacote') {
    throw new RegraDeNegocioViolada('MODALIDADE', 'Modalidade desconhecida.');
  }
  const servico = modalidade === 'pacote'
    ? entrada.servico - percentualDe(entrada.servico, entrada.descontoPacote ?? 0)
    : entrada.servico;
  const comissao = percentualDe(servico, parametros.comissao[modalidade]);
  const taxaCliente = parametros.taxaCliente[modalidade];
  const bruto = servico + transporte + taxaCliente;
  const cupom = Math.min(Math.max(entrada.cupom ?? 0, 0), comissao + taxaCliente);
  return {
    servico,
    transporte,
    taxaCliente,
    cupom,
    totalCliente: bruto - cupom,
    recebeDiarista: servico - comissao + transporte,
    comissao,
    receitaPlataforma: comissao + taxaCliente - cupom,
  };
}
