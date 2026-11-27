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
  // custos variáveis por atendimento (hipóteses do documento; trocar pelos valores reais)
  custosVariaveis: Object.freeze({ taxaPix: 0.0099, taxaCartao: 0.038, tarifaSplit: reais(1), aliquotaImposto: 0.06,
    seguro: reais(4), reserva: reais(4), suporte: reais(8) }),
  // faixas dos critérios de interrupção (propostas para calibrar)
  metasPiloto: Object.freeze({ recompraVerde: 0.5, recompraVermelho: 0.3, vazamentoVerde: 0.15, vazamentoVermelho: 0.3,
    cancelamentoVerde: 0.1, cancelamentoVermelho: 0.2, faltaVerde: 0.05, faltaVermelho: 0.1, margemVerde: reais(15) }),
});
