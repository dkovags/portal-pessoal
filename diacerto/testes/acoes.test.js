import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCasosDeUso } from '../src/aplicacao/casos-de-uso.js';
import { chaveDia } from '../src/aplicacao/datas.js';
import { criarInfraestruturaEmMemoria } from '../src/infraestrutura/memoria/index.js';
import { remarcarAtendimento, reais, STATUS } from '../src/dominio/index.js';

const HOJE = new Date(2026, 11, 1, 10); // terça
const montar = () => { const infra = criarInfraestruturaEmMemoria({ agora: HOJE }); return { infra, casos: criarCasosDeUso(infra) }; };
const livresDe = async (casos, id) => (await casos.obterPerfil(id)).proximosHorarios.map((h) => h.data);

test('remarcação: uma vez, até 24h antes, volta para aceite', () => {
  const a = { status: 'aceito', inicio: new Date(2026, 11, 3, 8), remarcacoes: 0 };
  const novo = { inicio: new Date(2026, 11, 7, 8), horaInicio: 8, horaFim: 17 };
  const r = remarcarAtendimento(a, { ...novo, agora: HOJE });
  assert.equal(r.status, 'solicitado');
  assert.throws(() => remarcarAtendimento(r, { ...novo, agora: HOJE }), { codigo: 'JA_REMARCADO' });
  assert.throws(() => remarcarAtendimento(a, { ...novo, agora: new Date(2026, 11, 2, 10) }), { codigo: 'PRAZO_REMARCACAO' });
  assert.throws(() => remarcarAtendimento({ ...a, status: 'concluido' }, { ...novo, agora: HOJE }), { codigo: 'NAO_REMARCAVEL' });
});

test('remarcar não cobra de novo nem gasta outro atendimento do pacote', async () => {
  const { casos, infra } = montar();
  const [, d1, d2] = await livresDe(casos, 'd1'); // o 1º dia livre fica a menos de 24h
  const a = await casos.solicitarReserva({ clienteId: 'c1', diaristaId: 'd1', data: d1, horaInicio: 8, duracao: 'diaria', modalidade: 'pacote', metodo: 'pix' });
  await casos.responderPedido({ atendimentoId: a.id, diaristaId: 'd1', aceitar: true });
  const usadosAntes = (await infra.pacotes.obterAtivo('c1', 'd1')).usados;
  const r = await casos.remarcarAtendimento({ atendimentoId: a.id, clienteId: 'c1', data: d2, horaInicio: 8 });
  assert.equal(r.status, STATUS.SOLICITADO);
  assert.equal(chaveDia(r.inicio), d2);
  await casos.responderPedido({ atendimentoId: a.id, diaristaId: 'd1', aceitar: true });
  assert.equal(infra.pagamento.registro.filter((x) => x.tipo === 'autorizacao').length, 1);
  assert.equal((await infra.pacotes.obterAtivo('c1', 'd1')).usados, usadosAntes);
  await assert.rejects(casos.remarcarAtendimento({ atendimentoId: a.id, clienteId: 'c2', data: d2, horaInicio: 8 }), { codigo: 'NAO_ENCONTRADO' });
});

test('prévia do cancelamento: grátis antes do aceite; depois, conforme a política', async () => {
  const { casos } = montar();
  const [d1] = await livresDe(casos, 'd3');
  const a = await casos.solicitarReserva({ clienteId: 'c2', diaristaId: 'd3', data: d1, horaInicio: 10, duracao: 'diaria', modalidade: 'avulso', metodo: 'pix' });
  assert.equal((await casos.simularCancelamento({ atendimentoId: a.id, clienteId: 'c2' })).gratuito, true);
  await casos.responderPedido({ atendimentoId: a.id, diaristaId: 'd3', aceitar: true });
  const p = await casos.simularCancelamento({ atendimentoId: a.id, clienteId: 'c2' });
  // d1 é o próximo dia livre: pode cair a menos de 24h, então só confere a coerência
  assert.equal(p.reembolsoCliente + p.devidoDiarista, a.valores.totalCliente);
  const c = await casos.cancelarPeloCliente({ atendimentoId: a.id, clienteId: 'c2' });
  assert.equal(c.status, STATUS.CANCELADO);
  await assert.rejects(casos.simularCancelamento({ atendimentoId: a.id, clienteId: 'c2' }), { codigo: 'NAO_CANCELAVEL' });
});

test('meus atendimentos: recentes e próximos, com o nome da outra parte', async () => {
  const { casos } = montar();
  const doCliente = await casos.meusAtendimentos({ clienteId: 'c1' });
  assert.ok(doCliente.every((x) => x.com));
  assert.ok(doCliente.some((x) => x.com === 'Marlene S.'));
  const daDiarista = await casos.meusAtendimentos({ diaristaId: 'd1' });
  assert.ok(daDiarista.some((x) => x.com === 'Carlos M.'));
  assert.equal(reais(1), 100);
});
