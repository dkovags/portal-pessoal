// RF7: parâmetros comerciais editáveis pela operação, com vigência e histórico.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCasosDeUso } from '../src/aplicacao/casos-de-uso.js';
import { criarInfraestruturaEmMemoria } from '../src/infraestrutura/memoria/index.js';
import { validarParametros, parteEditavel, aplicarParametros, calcularCancelamentoPeloCliente, reais, PARAMETROS_PADRAO } from '../src/dominio/index.js';
import { autorizar } from '../src/apresentacao/api/permissoes.js';

const HOJE = new Date(2026, 11, 1, 10);
function montar() {
  const infra = criarInfraestruturaEmMemoria({ agora: HOJE });
  return { infra, casos: criarCasosDeUso(infra) };
}
const com = (mudanca) => {
  const v = structuredClone(parteEditavel(PARAMETROS_PADRAO));
  for (const [grupo, campos] of Object.entries(mudanca)) Object.assign(v[grupo], campos);
  return v;
};

test('domínio: só a parte editável, dentro dos limites', () => {
  assert.deepEqual(validarParametros(parteEditavel(PARAMETROS_PADRAO)), parteEditavel(PARAMETROS_PADRAO));
  assert.throws(() => validarParametros(com({ comissao: { avulso: 0.6 } })), { codigo: 'PARAMETRO' });
  assert.throws(() => validarParametros(com({ pacote: { descontoMaximo: 0.35 } })), { codigo: 'PARAMETRO' });
  assert.throws(() => validarParametros(com({ taxaCliente: { avulso: 15.5 } })), { codigo: 'PARAMETRO' }, 'centavos inteiros');
  assert.throws(() => validarParametros(com({ piso: { meiaDiaria: reais(140) } })), { codigo: 'PARAMETRO' });
  const juntos = aplicarParametros(PARAMETROS_PADRAO, com({ comissao: { avulso: 0.18 } }));
  assert.equal(juntos.comissao.avulso, 0.18);
  assert.deepEqual(juntos.janela, PARAMETROS_PADRAO.janela, 'janela não é editável');
});

test('domínio: cancelamento usa a política gravada na reserva', () => {
  const a = { inicio: new Date(2026, 11, 3, 8), totalCliente: reais(235), recebeDiarista: reais(180) };
  const agora = new Date(2026, 11, 2, 0); // 32h antes
  assert.equal(calcularCancelamentoPeloCliente(a, agora).gratuito, true);
  const r = calcularCancelamentoPeloCliente({ ...a, politicaCancelamento: { horasGratuitas: 48, percentualDevidoDiarista: 0.3 } }, agora);
  assert.deepEqual([r.gratuito, r.devidoDiarista], [false, reais(54)]);
});

test('alterar: exige motivo e mudança; vale para reservas novas e fica no histórico', async () => {
  const { casos } = montar();
  const valores = com({ comissao: { avulso: 0.18 }, taxaCliente: { avulso: reais(14) }, cancelamento: { horasGratuitas: 48 } });
  await assert.rejects(casos.alterarParametros({ valores, motivo: 'curto', alteradoPor: 'op@x.com' }), { codigo: 'MOTIVO' });
  await assert.rejects(casos.alterarParametros({ valores: parteEditavel(PARAMETROS_PADRAO), motivo: 'Nada mudou de verdade aqui', alteradoPor: 'op@x.com' }), { codigo: 'SEM_MUDANCA' });

  const [, dia] = (await casos.obterPerfil('d1')).proximosHorarios.map((h) => h.data);
  const antiga = await casos.solicitarReserva({ clienteId: 'c2', diaristaId: 'd1', data: dia, horaInicio: 8, duracao: 'diaria', modalidade: 'avulso', metodo: 'pix' });
  const v = await casos.alterarParametros({ valores, motivo: 'Teste de comissão menor no avulso', alteradoPor: 'op@x.com' });
  assert.deepEqual(v.abaixoDoPiso, []);

  const sim = await casos.simularReserva({ diaristaId: 'd1', clienteId: 'c2' });
  assert.equal(sim.valores.comissao, reais(36)); // 18% de 200
  assert.equal(sim.valores.taxaCliente, reais(14));
  assert.equal(sim.politicaCancelamento.horasGratuitas, 48);
  const guardada = (await casos.listarAtendimentosOperacao({ status: 'todos' })).find((a) => a.id === antiga.id);
  assert.equal(guardada.valores.comissao, reais(40), 'reserva antiga mantém os valores');
  assert.equal(guardada.politicaCancelamento.horasGratuitas, 24, 'e a política da época');

  const hist = await casos.historicoParametros();
  assert.equal(hist.length, 2);
  assert.equal(hist[0].alteradoPor, 'op@x.com');
  assert.deepEqual(hist[0].mudancas.map((m) => m.campo).sort(), ['cancelamento.horasGratuitas', 'comissao.avulso', 'taxaCliente.avulso']);
  assert.deepEqual(hist[1].mudancas, [], 'a versão inicial não tem anterior');
  const pub = await casos.parametrosVigentes();
  assert.equal(pub.valores.comissao.avulso, 0.18);
  assert.equal(pub.alteradoPor, undefined, 'público não vê quem alterou');
});

test('piso maior avisa quem ficou abaixo e passa a valer na troca de preços', async () => {
  const { casos } = montar();
  const r = await casos.alterarParametros({ valores: com({ piso: { diaria: reais(185) } }), motivo: 'Piso acordado com as profissionais', alteradoPor: 'op@x.com' });
  assert.deepEqual(r.abaixoDoPiso.map((d) => d.id), ['d3']);
  await assert.rejects(casos.atualizarPrecos('d3', { diaria: reais(180), meiaDiaria: reais(100), transporte: reais(15), descontoPacote: 0.1 }), { codigo: 'PISO_DIARIA', message: /R\$\s185,00/ });
  const painel = await casos.painelDiarista('d1');
  assert.equal(painel.piso.diaria, reais(185));
});

test('pacote comprado mantém preço e política mesmo com mudança depois', async () => {
  const { casos } = montar();
  await casos.alterarParametros({ valores: com({ comissao: { pacote: 0.1 }, cancelamento: { percentualDevidoDiarista: 0.8 } }), motivo: 'Campanha de pacotes de dezembro', alteradoPor: 'op@x.com' });
  const sim = await casos.simularReserva({ diaristaId: 'd1', clienteId: 'c1' });
  assert.equal(sim.modalidade, 'pacote');
  assert.equal(sim.valores.comissao, reais(27), 'preço travado em 15%');
  assert.equal(sim.politicaCancelamento.percentualDevidoDiarista, 0.5);
  const novo = await casos.comprarPacote({ clienteId: 'c2', diaristaId: 'd3' });
  assert.equal(novo.unitario.comissao, reais(16.2)); // 10% de 162
});

test('servidor: quem altera é sempre quem está logado na operação', async () => {
  const [args] = await autorizar('alterarParametros', [{ valores: {}, motivo: 'x', alteradoPor: 'outra@x.com' }], { email: 'op@x.com', papel: 'operacao' }, {});
  assert.equal(args.alteradoPor, 'op@x.com');
  await assert.rejects(autorizar('alterarParametros', [{}], { email: 'ana@x.com', papel: 'cliente', clienteId: 'c1' }, {}), { name: 'SemPermissao' });
  await assert.rejects(autorizar('historicoParametros', [], { email: 'ana@x.com', papel: 'cliente', clienteId: 'c1' }, {}), { name: 'SemPermissao' });
  assert.deepEqual(await autorizar('parametrosVigentes', [], null, {}), []);
});
