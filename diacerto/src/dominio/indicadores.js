import { percentualDe } from './dinheiro.js';
import { PARAMETROS_PADRAO } from './parametros.js';

// Indicadores de interrupção do piloto (documento "Análise crítica e modelo do piloto").
// Cada indicador traz valor, faixa (verde, amarelo, vermelho ou sem_dados) e a regra usada.

const DIA = 864e5;

/** Margem de contribuição de um atendimento concluído, com os custos variáveis hipotéticos. */
export function margemDeContribuicao(a, custos = PARAMETROS_PADRAO.custosVariaveis) {
  const v = a.valores;
  const taxa = a.metodo === 'cartao' ? custos.taxaCartao : custos.taxaPix;
  const pagamento = percentualDe(v.totalCliente, taxa) + custos.tarifaSplit;
  const imposto = percentualDe(Math.max(v.receitaPlataforma, 0), custos.aliquotaImposto);
  return v.receitaPlataforma - pagamento - imposto - custos.seguro - custos.reserva - custos.suporte;
}

function faixa(valor, verde, vermelho, maiorMelhor) {
  if (valor === null) return 'sem_dados';
  if (maiorMelhor) return valor >= verde ? 'verde' : valor < vermelho ? 'vermelho' : 'amarelo';
  return valor <= verde ? 'verde' : valor > vermelho ? 'vermelho' : 'amarelo';
}
const razao = (n, d) => (d ? n / d : null);

/**
 * @param {{atendimentos:any[], ocorrencias:any[], agora:Date}} dados
 */
export function calcularIndicadores({ atendimentos, ocorrencias, agora }, parametros = PARAMETROS_PADRAO) {
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const concluidos = atendimentos.filter((a) => a.status === 'concluido');
  const pedidos = atendimentos.filter((a) => a.status !== 'recusado');
  const cancelados = atendimentos.filter((a) => a.status === 'cancelado');
  const realizados = atendimentos.filter((a) => ['aceito', 'em_andamento', 'concluido'].includes(a.status) || a.status === 'cancelado');
  const faltas = ocorrencias.filter((o) => o.tipo === 'falta_diarista');

  // recompra: clientes cujo 1º atendimento concluído tem 30+ dias; voltou a reservar em até 30 dias?
  const porCliente = new Map();
  for (const a of atendimentos) {
    if (!porCliente.has(a.clienteId)) porCliente.set(a.clienteId, []);
    porCliente.get(a.clienteId).push(a);
  }
  let elegiveis = 0; let voltaram = 0;
  for (const lista of porCliente.values()) {
    const ordem = lista.filter((a) => a.status === 'concluido').sort((x, y) => x.inicio - y.inicio);
    if (!ordem.length || hoje - ordem[0].inicio.getTime() < 30 * DIA) continue;
    elegiveis++;
    const primeiro = ordem[0].inicio.getTime();
    if (lista.some((a) => a !== ordem[0] && !['recusado', 'cancelado'].includes(a.status)
      && a.inicio.getTime() > primeiro && a.inicio.getTime() - primeiro <= 30 * DIA)) voltaram++;
  }

  // vazamento: pares com 2+ concluídos, sem nada nos últimos 30 dias nem agendado, e sem reclamação
  const pares = new Map();
  for (const a of atendimentos) {
    const k = `${a.clienteId}|${a.diaristaId}`;
    if (!pares.has(k)) pares.set(k, []);
    pares.get(k).push(a);
  }
  const comReclamacao = new Set(ocorrencias.map((o) => {
    const a = atendimentos.find((x) => x.id === o.atendimentoId);
    return a ? `${a.clienteId}|${a.diaristaId}` : null;
  }));
  let paresFieis = 0; let sumiram = 0;
  for (const [k, lista] of pares) {
    if (lista.filter((a) => a.status === 'concluido').length < 2) continue;
    paresFieis++;
    const ativoRecente = lista.some((a) => !['recusado', 'cancelado'].includes(a.status) && a.inicio.getTime() >= hoje - 30 * DIA);
    if (!ativoRecente && !comReclamacao.has(k)) sumiram++;
  }

  const margens = concluidos.map((a) => margemDeContribuicao(a, parametros.custosVariaveis));
  const margemMedia = margens.length ? Math.round(margens.reduce((s, m) => s + m, 0) / margens.length) : null;
  const gravesAtrasadas = ocorrencias.filter((o) => o.gravidade === 'grave' && o.status === 'aberta'
    && agora.getTime() - new Date(o.abertaEm).getTime() > 72 * 36e5).length;

  const mes = (a) => a.concluidoEm && a.concluidoEm.getMonth() === agora.getMonth() && a.concluidoEm.getFullYear() === agora.getFullYear();
  const doMes = concluidos.filter(mes);

  const t = parametros.metasPiloto;
  const indicador = (id, rotulo, valor, formato, verde, vermelho, maiorMelhor, regra) =>
    ({ id, rotulo, valor, formato, faixa: faixa(valor, verde, vermelho, maiorMelhor), regra });

  return {
    indicadores: [
      indicador('recompra', 'Recompra em 30 dias', razao(voltaram, elegiveis), 'percentual', t.recompraVerde, t.recompraVermelho, true,
        `Clientes com 30+ dias desde o 1º atendimento (${elegiveis}) que reservaram de novo em até 30 dias.`),
      indicador('vazamento', 'Pares que sumiram', razao(sumiram, paresFieis), 'percentual', t.vazamentoVerde, t.vazamentoVermelho, false,
        `Duplas com 2+ atendimentos (${paresFieis}) sem reserva há 30 dias e sem reclamação.`),
      indicador('cancelamento', 'Cancelamentos', razao(cancelados.length, pedidos.length), 'percentual', t.cancelamentoVerde, t.cancelamentoVermelho, false,
        `${cancelados.length} de ${pedidos.length} pedidos não recusados.`),
      indicador('falta', 'Faltas da profissional', razao(faltas.length, realizados.length), 'percentual', t.faltaVerde, t.faltaVermelho, false,
        `${faltas.length} ocorrências de falta em ${realizados.length} atendimentos aceitos.`),
      indicador('margem', 'Margem de contribuição média', margemMedia, 'reais', t.margemVerde, 0, true,
        `Média de ${concluidos.length} atendimentos concluídos, já descontados pagamento, imposto, seguro, reserva e suporte.`),
      indicador('graves', 'Ocorrências graves abertas há mais de 72h', ocorrencias.length || atendimentos.length ? gravesAtrasadas : null, 'numero', 0, 0, false,
        'Qualquer uma é sinal vermelho.'),
    ],
    mes: {
      atendimentos: doMes.length,
      transacionado: doMes.reduce((s, a) => s + a.valores.totalCliente, 0),
      receita: doMes.reduce((s, a) => s + a.valores.receitaPlataforma, 0),
      reembolsos: ocorrencias.filter((o) => o.resolvidaEm && new Date(o.resolvidaEm).getMonth() === agora.getMonth()).reduce((s, o) => s + o.reembolso, 0),
    },
  };
}
