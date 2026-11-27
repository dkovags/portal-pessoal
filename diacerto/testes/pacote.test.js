// RF11: pacote comprado de uma vez, saldo calculado pelos atendimentos, encerramento e desistência.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCasosDeUso } from '../src/aplicacao/casos-de-uso.js';
import { criarInfraestruturaEmMemoria } from '../src/infraestrutura/memoria/index.js';
import { novoPacote, situacaoDoPacote, consomePacote, encerrarPacote, reais, STATUS } from '../src/dominio/index.js';

const HOJE = new Date(2026, 11, 1, 10); // terça, 1º/12/2026
const precos = { diaria: reais(180), meiaDiaria: reais(100), transporte: reais(15), descontoPacote: 0.1 };

function montar(agora = HOJE) {
  const infra = criarInfraestruturaEmMemoria({ agora });
  return { infra, casos: criarCasosDeUso(infra) };
}
const livres = async (casos, id) => (await casos.obterPerfil(id)).proximosHorarios.map((h) => h.data);
const pacoteDe = async (casos, clienteId, id) => (await casos.meusPacotes({ clienteId })).find((p) => p.id === id);

test('domínio: preço travado na compra e saldo pelos atendimentos', () => {
  const p = novoPacote({ id: 'p', clienteId: 'c', diaristaId: 'd', duracao: 'diaria', precos, metodo: 'pix', agora: HOJE });
  assert.equal(p.unitario.totalCliente, reais(189));
  assert.equal(p.totalPago, reais(756));
  assert.equal(p.validade.getMonth(), 2, 'três meses');
  assert.deepEqual(p.politicaCancelamento, { horasGratuitas: 24, percentualDevidoDiarista: 0.5 });
  const at = (status, extra = {}) => ({ pacoteId: 'p', status, ...extra });
  const s = situacaoDoPacote(p, [at('concluido'), at('aceito'), at('recusado'), at('cancelado'), at('cancelado', { taxaCancelamento: 500 }), { pacoteId: 'outro', status: 'aceito' }], HOJE);
  assert.deepEqual([s.usados, s.agendados, s.realizados, s.saldo], [3, 1, 2, 1]);
  assert.equal(s.podeEncerrar, false, 'há atendimento marcado');
  assert.equal(consomePacote({ status: 'cancelado', taxaCancelamento: 0 }), false);
  assert.throws(() => encerrarPacote(s, HOJE), { codigo: 'PACOTE_AGENDADOS' });
  const vencido = situacaoDoPacote(p, [], new Date(2027, 2, 2));
  assert.equal(vencido.disponivel, false);
  assert.equal(vencido.podeEncerrar, true, 'saldo de pacote vencido também é devolvido');
  assert.equal(vencido.valorReembolsavel, reais(756));
});

test('comprar: autoriza o total, bloqueia segundo pacote com saldo da mesma dupla', async () => {
  const { casos, infra } = montar();
  await assert.rejects(casos.comprarPacote({ clienteId: 'c1', diaristaId: 'd1', duracao: 'diaria' }), { codigo: 'PACOTE_ATIVO' });
  const meia = await casos.comprarPacote({ clienteId: 'c1', diaristaId: 'd1', duracao: 'meiaDiaria', metodo: 'cartao' });
  assert.equal(meia.duracao, 'meiaDiaria');
  assert.equal(meia.metodo, 'cartao');
  assert.equal(meia.saldo, 4);
  assert.equal(meia.desistencia, true);
  const aut = infra.pagamento.registro.at(-1);
  assert.deepEqual([aut.tipo, aut.valor, aut.pacoteId], ['autorizacao', meia.totalPago, meia.id]);
  assert.equal(infra.notificador.enviadas.at(-1).para, 'd1');
});

test('reservar pelo pacote: sem cobrança no aceite; recusa e cancelamento gratuito devolvem o atendimento', async () => {
  const { casos, infra } = montar();
  const [, dia] = await livres(casos, 'd1'); // 2º dia livre: mais de 24h à frente
  const a = await casos.solicitarReserva({ clienteId: 'c1', diaristaId: 'd1', data: dia, horaInicio: 8, duracao: 'diaria', modalidade: 'pacote', metodo: 'pix' });
  assert.equal((await pacoteDe(casos, 'c1', 'p1')).saldo, 2);
  await casos.responderPedido({ atendimentoId: a.id, diaristaId: 'd1', aceitar: false });
  assert.equal((await pacoteDe(casos, 'c1', 'p1')).saldo, 3, 'recusa devolve');
  const b = await casos.solicitarReserva({ clienteId: 'c1', diaristaId: 'd1', data: dia, horaInicio: 8, duracao: 'diaria', modalidade: 'pacote', metodo: 'pix' });
  await casos.responderPedido({ atendimentoId: b.id, diaristaId: 'd1', aceitar: true });
  assert.equal(infra.pagamento.registro.length, 0, 'nenhuma cobrança nova');
  const previa = await casos.simularCancelamento({ atendimentoId: b.id, clienteId: 'c1' });
  assert.deepEqual([previa.gratuito, previa.voltaAoPacote, previa.reembolsoCliente], [true, true, 0]);
  await casos.cancelarPeloCliente({ atendimentoId: b.id, clienteId: 'c1' });
  assert.equal(infra.pagamento.registro.length, 0, 'volta ao saldo, não vira dinheiro');
  assert.equal((await pacoteDe(casos, 'c1', 'p1')).saldo, 3);
});

test('cancelamento tardio pelo pacote: gasta o atendimento, paga a parte da diarista e devolve o resto', async () => {
  const { casos, infra } = montar();
  const [dia] = await livres(casos, 'd1');
  const a = await casos.solicitarReserva({ clienteId: 'c1', diaristaId: 'd1', data: dia, horaInicio: 8, duracao: 'diaria', modalidade: 'pacote', metodo: 'pix' });
  await casos.responderPedido({ atendimentoId: a.id, diaristaId: 'd1', aceitar: true });
  const tarde = criarCasosDeUso({ ...infra, relogio: { agora: () => new Date(a.inicio.getTime() - 2 * 36e5) } });
  const c = await tarde.cancelarPeloCliente({ atendimentoId: a.id, clienteId: 'c1' });
  assert.equal(c.gratuito, false);
  assert.equal(c.taxaCancelamento, reais(86.5)); // 50% de 173
  const [estorno, captura] = infra.pagamento.registro;
  assert.deepEqual([estorno.tipo, estorno.valor], ['estorno', reais(212) - reais(86.5)]);
  assert.deepEqual([captura.tipo, captura.repasseDiarista], ['captura', reais(86.5)]);
  assert.equal((await pacoteDe(tarde, 'c1', 'p1')).saldo, 2);
});

test('encerrar: devolve o saldo; não encerra com atendimento marcado nem duas vezes', async () => {
  const { casos, infra } = montar();
  const [, , d3] = await livres(casos, 'd1');
  const a = await casos.solicitarReserva({ clienteId: 'c1', diaristaId: 'd1', data: d3, horaInicio: 8, duracao: 'diaria', modalidade: 'pacote', metodo: 'pix' });
  await assert.rejects(casos.encerrarPacote({ pacoteId: 'p1', clienteId: 'c1' }), { codigo: 'PACOTE_AGENDADOS' });
  await casos.cancelarPeloCliente({ atendimentoId: a.id, clienteId: 'c1' });
  await assert.rejects(casos.encerrarPacote({ pacoteId: 'p1', clienteId: 'c2' }), { codigo: 'NAO_ENCONTRADO' });
  const e = await casos.encerrarPacote({ pacoteId: 'p1', clienteId: 'c1' });
  assert.equal(e.status, 'encerrado');
  assert.equal(e.desistencia, false, 'já houve atendimento');
  assert.equal(e.reembolso, reais(212) * 3);
  assert.deepEqual([infra.pagamento.registro.at(-1).tipo, infra.pagamento.registro.at(-1).valor], ['estorno', reais(636)]);
  await assert.rejects(casos.encerrarPacote({ pacoteId: 'p1', clienteId: 'c1' }), { codigo: 'PACOTE_ENCERRADO' });
  assert.equal((await casos.simularReserva({ diaristaId: 'd1', clienteId: 'c1' })).modalidade, 'avulso');
});

test('desistência em até 7 dias sem uso devolve tudo; depois disso vira encerramento comum', async () => {
  const { casos, infra } = montar();
  const p = await casos.comprarPacote({ clienteId: 'c2', diaristaId: 'd3', duracao: 'diaria' });
  const e = await casos.encerrarPacote({ pacoteId: p.id, clienteId: 'c2' });
  assert.equal(e.desistencia, true);
  assert.equal(e.reembolso, p.totalPago);
  const depois = montar(new Date(2026, 11, 20, 10));
  const q = await depois.casos.comprarPacote({ clienteId: 'c2', diaristaId: 'd3', duracao: 'diaria' });
  const oitoDias = criarCasosDeUso({ ...depois.infra, relogio: { agora: () => new Date(2026, 11, 28, 11) } });
  assert.equal((await pacoteDe(oitoDias, 'c2', q.id)).desistencia, false);
  assert.ok(infra.pagamento.registro.some((r) => r.tipo === 'estorno' && r.motivo === `desistencia-pacote:${p.id}`));
});

test('meus pacotes: ativos primeiro, com nome da profissional; atendimentos guardam o pacote', async () => {
  const { casos, infra } = montar();
  const lista = await casos.meusPacotes({ clienteId: 'c1' });
  assert.deepEqual(lista.map((p) => [p.id, p.diaristaNome, p.saldo, p.realizados]), [['p1', 'Marlene S.', 3, 1]]);
  const doPacote = (await infra.atendimentos.listarPorCliente('c1')).filter((a) => a.pacoteId === 'p1');
  assert.equal(doPacote.length, 1);
  assert.equal(doPacote[0].status, STATUS.CONCLUIDO);
});
