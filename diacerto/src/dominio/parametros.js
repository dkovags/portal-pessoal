import { reais } from './dinheiro.js';

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
});
