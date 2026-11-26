import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCasosDeUso } from '../src/aplicacao/casos-de-uso.js';
import { chaveDia } from '../src/aplicacao/datas.js';
import { criarInfraestruturaEmMemoria } from '../src/infraestrutura/memoria/index.js';
import { reais, STATUS } from '../src/dominio/index.js';

const HOJE = new Date(2026, 11, 1, 10); // terça, 1º/12/2026

function montar() {
  const infra = criarInfraestruturaEmMemoria({ agora: HOJE });
  return { infra, casos: criarCasosDeUso(infra) };
}
function proximo(diaSemana) {
  const d = new Date(HOJE); d.setDate(d.getDate() + 1);
  while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
  return chaveDia(d);
}

test('busca devolve preço total avulso já com transporte e taxa', async () => {
  const { casos } = montar();
  const lista = await casos.buscarProfissionais({ regiao: 'Asa Norte' });
  const marlene = lista.find((p) => p.id === 'd1');
  assert.equal(marlene.totalAvulso, reais(235));
  assert.equal(marlene.atendimentos, 6);
});

test('busca por data respeita a agenda e a duração', async () => {
  const { casos } = montar();
  const sexta = proximo(5);
  const integral = await casos.buscarProfissionais({ data: sexta, duracao: 'diaria' });
  assert.deepEqual(integral.map((p) => p.id), []);
  const meia = await casos.buscarProfissionais({ data: sexta, duracao: 'meiaDiaria' });
  assert.deepEqual(meia.map((p) => p.id), ['d2']);
});

test('cliente com pacote ativo reserva no preço do pacote; cupom não reduz a diarista', async () => {
  const { casos } = montar();
  const sim = await casos.simularReserva({ diaristaId: 'd1', clienteId: 'c1', codigoCupom: 'lancamento' });
  assert.equal(sim.modalidade, 'pacote');
  assert.equal(sim.valores.totalCliente, reais(182));
  assert.equal(sim.valores.recebeDiarista, reais(173));
});

test('cupom inválido é recusado', async () => {
  const { casos } = montar();
  await assert.rejects(casos.simularReserva({ diaristaId: 'd2', clienteId: 'c1', codigoCupom: 'XPTO' }), { codigo: 'CUPOM_INVALIDO' });
});

test('fluxo completo: pedido, aceite com cobrança, chegada por código, conclusão com split', async () => {
  const { casos, infra } = montar();
  const quarta = proximo(3);
  const a = await casos.solicitarReserva({ clienteId: 'c2', diaristaId: 'd1', data: quarta, horaInicio: 8, duracao: 'diaria', modalidade: 'avulso', metodo: 'pix' });
  assert.equal(a.status, STATUS.SOLICITADO);
  assert.equal(infra.pagamento.registro.length, 0, 'não cobra antes do aceite');
  assert.equal(infra.notificador.enviadas.at(-1).para, 'd1');

  const aceito = await casos.responderPedido({ atendimentoId: a.id, diaristaId: 'd1', aceitar: true });
  assert.equal(aceito.status, STATUS.ACEITO);
  assert.equal(infra.pagamento.registro[0].valor, reais(235));

  await casos.confirmarChegada({ atendimentoId: a.id, codigo: a.codigoConfirmacao });
  await casos.concluirAtendimento({ atendimentoId: a.id });
  const captura = infra.pagamento.registro.find((r) => r.tipo === 'captura');
  assert.equal(captura.repasseDiarista, reais(180));
});

test('recusa não gera cobrança', async () => {
  const { casos, infra } = montar();
  const painel = await casos.painelDiarista('d1');
  const pedido = painel.pendentes[0];
  await casos.responderPedido({ atendimentoId: pedido.id, diaristaId: 'd1', aceitar: false });
  assert.equal(infra.pagamento.registro.length, 0);
});

test('limite semanal e horário fora da janela', async () => {
  const { casos } = montar();
  // segunda da semana seguinte à próxima (sem pedidos prévios na agenda fictícia)
  const segundaBase = new Date(proximo(1) + 'T00:00'); segundaBase.setDate(segundaBase.getDate() + 7);
  const dia = (n) => { const d = new Date(segundaBase); d.setDate(d.getDate() + n); return chaveDia(d); };
  const [segunda, terca, quarta] = [dia(0), dia(1), dia(2)];
  const base = { clienteId: 'c3', diaristaId: 'd1', horaInicio: 8, duracao: 'diaria', modalidade: 'avulso', metodo: 'pix' };
  await casos.solicitarReserva({ ...base, data: segunda });
  await casos.solicitarReserva({ ...base, data: terca });
  await assert.rejects(casos.solicitarReserva({ ...base, data: quarta }), { codigo: 'LIMITE_SEMANAL' });
  await assert.rejects(casos.solicitarReserva({ ...base, clienteId: 'c1', data: quarta, horaInicio: 12 }), { codigo: 'FORA_DA_JANELA' });
});

test('preço abaixo do piso é recusado ao salvar', async () => {
  const { casos } = montar();
  await assert.rejects(casos.atualizarPrecos('d1', { diaria: reais(100), meiaDiaria: reais(110), transporte: reais(20), descontoPacote: 0.1 }), { codigo: 'PISO_DIARIA' });
  const sim = await casos.atualizarPrecos('d1', { diaria: reais(220), meiaDiaria: reais(120), transporte: reais(20), descontoPacote: 0.1 });
  assert.equal(sim.avulso.recebeDiarista, reais(196));
});

test('minhas diaristas: mais frequente primeiro, com pacote e saldo', async () => {
  const { casos } = montar();
  const lista = await casos.minhasDiaristas('c1');
  assert.equal(lista[0].diarista.id, 'd1');
  assert.equal(lista[0].vezes, 4);
  assert.equal(lista[0].pacote.total - lista[0].pacote.usados, 3);
});

test('contratar pacote cria o pacote e cobra o preço com desconto', async () => {
  const { casos } = montar();
  const a = await casos.solicitarReserva({ clienteId: 'c2', diaristaId: 'd3', data: proximo(2), horaInicio: 10, duracao: 'diaria', modalidade: 'pacote', metodo: 'pix' });
  assert.equal(a.modalidade, 'pacote');
  assert.equal(a.valores.totalCliente, reais(162 + 15 + 12)); // 180 - 10% = 162, transporte 15, taxa 12
  const sim = await casos.simularReserva({ diaristaId: 'd3', clienteId: 'c2' });
  assert.equal(sim.pacoteAtivo.total, 4);
});

test('dia com pedido pendente não aparece como horário livre', async () => {
  const { casos } = montar();
  const painel = await casos.painelDiarista('d1');
  const diaDoPedido = chaveDia(painel.pendentes[0].inicio);
  const perfil = await casos.obterPerfil('d1');
  assert.ok(!perfil.proximosHorarios.some((h) => h.data === diaDoPedido));
  const busca = await casos.buscarProfissionais({ data: diaDoPedido });
  assert.ok(!busca.some((p) => p.id === 'd1'));
});
