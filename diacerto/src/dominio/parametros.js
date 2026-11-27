import { reais } from './dinheiro.js';
import { RegraDeNegocioViolada } from './erros.js';

// Parâmetros comerciais do piloto. São hipóteses de teste (ver documento
// "DiaCerto – Análise crítica e modelo do piloto") e devem ser configuráveis.
export const PARAMETROS_PADRAO = Object.freeze({
  comissao: Object.freeze({ avulso: 0.20, pacote: 0.15 }),
  taxaCliente: Object.freeze({ avulso: reais(15), pacote: reais(12) }),
  piso: Object.freeze({ diaria: reais(130), meiaDiaria: reais(70) }),
  pacote: Object.freeze({ quantidade: 4, descontoMaximo: 0.30, validadeMeses: 3 }),
  limiteSemanalMesmoCliente: 2,
  cancelamento: Object.freeze({ horasGratuitas: 24, percentualDevidoDiarista: 0.5 }),
  janela: Object.freeze({ inicio: 7, fim: 20 }),
  // RF03: horas que o cliente tem para confirmar ou contestar a conclusão
  conclusao: Object.freeze({ horasParaContestar: 24 }),
  // custos variáveis por atendimento (hipóteses do documento; trocar pelos valores reais)
  custosVariaveis: Object.freeze({ taxaPix: 0.0099, taxaCartao: 0.038, tarifaSplit: reais(1), aliquotaImposto: 0.06,
    seguro: reais(4), reserva: reais(4), suporte: reais(8) }),
  // faixas dos critérios de interrupção (propostas para calibrar)
  metasPiloto: Object.freeze({ recompraVerde: 0.5, recompraVermelho: 0.3, vazamentoVerde: 0.15, vazamentoVermelho: 0.3,
    cancelamentoVerde: 0.1, cancelamentoVermelho: 0.2, faltaVerde: 0.05, faltaVermelho: 0.1, margemVerde: reais(15) }),
});

// Parâmetros que a operação pode alterar (RF7). A janela de funcionamento e o limite semanal
// ficam fixos: o banco também os exige. Cada alteração vale para reservas e pacotes novos;
// o que já foi contratado guarda os próprios valores.
export const LIMITES_EDITAVEIS = Object.freeze({
  comissao: { avulso: [0, 0.5], pacote: [0, 0.5] },
  taxaCliente: { avulso: [0, reais(100)], pacote: [0, reais(100)] },
  piso: { diaria: [reais(50), reais(1000)], meiaDiaria: [reais(30), reais(1000)] },
  cancelamento: { horasGratuitas: [0, 168], percentualDevidoDiarista: [0, 1] },
  pacote: { quantidade: [2, 20], descontoMaximo: [0, 0.3], validadeMeses: [1, 24] },
});
const INTEIROS = new Set(['taxaCliente.avulso', 'taxaCliente.pacote', 'piso.diaria', 'piso.meiaDiaria',
  'cancelamento.horasGratuitas', 'pacote.quantidade', 'pacote.validadeMeses']);

/** Só a parte editável dos parâmetros, validada. @returns {{comissao, taxaCliente, piso, cancelamento, pacote}} */
export function validarParametros(valores) {
  const saida = {};
  for (const [grupo, campos] of Object.entries(LIMITES_EDITAVEIS)) {
    saida[grupo] = {};
    for (const [campo, [min, max]] of Object.entries(campos)) {
      const v = Number(valores?.[grupo]?.[campo]);
      const nome = `${grupo}.${campo}`;
      if (!Number.isFinite(v) || v < min || v > max || (INTEIROS.has(nome) && !Number.isInteger(v))) {
        throw new RegraDeNegocioViolada('PARAMETRO', `Valor fora do permitido em ${nome} (de ${min} a ${max}).`);
      }
      saida[grupo][campo] = v;
    }
  }
  if (saida.piso.meiaDiaria > saida.piso.diaria) {
    throw new RegraDeNegocioViolada('PARAMETRO', 'O piso da meia diária não pode passar o da diária.');
  }
  return saida;
}

/** Parâmetros completos: os padrões com a parte editável da versão vigente por cima. */
export function aplicarParametros(base, editaveis) {
  if (!editaveis) return base;
  const r = { ...base };
  for (const grupo of Object.keys(LIMITES_EDITAVEIS)) if (editaveis[grupo]) r[grupo] = { ...base[grupo], ...editaveis[grupo] };
  return r;
}

/** A parte editável de um conjunto completo de parâmetros. */
export function parteEditavel(parametros) {
  return Object.fromEntries(Object.keys(LIMITES_EDITAVEIS).map((g) => [g, { ...parametros[g] }]));
}
