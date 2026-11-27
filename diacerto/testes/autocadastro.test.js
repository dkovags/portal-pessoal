// RF14: autocadastro do cliente com Google, celular, endereço e aceite versionado dos documentos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCasosDeUso } from '../src/aplicacao/casos-de-uso.js';
import { criarInfraestruturaEmMemoria } from '../src/infraestrutura/memoria/index.js';
import { aceitesPendentes, validarAceites, DOCUMENTOS_LEGAIS, DOCUMENTOS_POR_PAPEL } from '../src/dominio/index.js';
import { autorizar } from '../src/apresentacao/api/permissoes.js';
import { TEXTOS_LEGAIS } from '../src/apresentacao/textos-legais.js';

const HOJE = new Date(2026, 11, 1, 10);
function montar() {
  const infra = criarInfraestruturaEmMemoria({ agora: HOJE });
  return { infra, casos: criarCasosDeUso(infra) };
}
const vigentes = (papel) => Object.fromEntries(DOCUMENTOS_POR_PAPEL[papel].map((id) => [id, DOCUMENTOS_LEGAIS[id].versao]));
const dados = { email: 'Nova.Cliente@Gmail.com', nome: 'Beatriz Nogueira', celular: '(61) 99876-5432', endereco: 'SQS 114, Bloco [X], apto [Y]', regiao: 'Asa Sul' };

test('domínio: pendências e aceite na versão vigente', () => {
  assert.deepEqual(aceitesPendentes('cliente', []).map((d) => d.documento), ['termos-cliente', 'privacidade']);
  assert.deepEqual(aceitesPendentes('diarista', [{ documento: 'privacidade', versao: DOCUMENTOS_LEGAIS.privacidade.versao }]).map((d) => d.documento), ['termos-profissional']);
  assert.deepEqual(aceitesPendentes('cliente', [{ documento: 'termos-cliente', versao: '2000-01-01' }, { documento: 'privacidade', versao: DOCUMENTOS_LEGAIS.privacidade.versao }]).map((d) => d.documento), ['termos-cliente'], 'versão antiga não vale');
  assert.deepEqual(aceitesPendentes('operacao', []), []);
  assert.throws(() => validarAceites('cliente', { 'termos-cliente': DOCUMENTOS_LEGAIS['termos-cliente'].versao }), { codigo: 'ACEITE' });
});

test('cada documento exigido tem texto na mesma versão, marcado como rascunho para revisão', () => {
  for (const [id, doc] of Object.entries(DOCUMENTOS_LEGAIS)) {
    assert.equal(TEXTOS_LEGAIS[id]?.versao, doc.versao, id);
    assert.ok(TEXTOS_LEGAIS[id].secoes.length >= 4, id);
    assert.match(TEXTOS_LEGAIS[id].aviso, /revisão jurídica/);
  }
});

test('autocadastro cria cliente, perfil e aceites; não repete nem aceita dados ruins', async () => {
  const { casos, infra } = montar();
  await assert.rejects(casos.autocadastrarCliente({ ...dados, aceites: {} }), { codigo: 'ACEITE' });
  await assert.rejects(casos.autocadastrarCliente({ ...dados, celular: '9999', aceites: vigentes('cliente') }), { codigo: 'CELULAR' });
  await assert.rejects(casos.autocadastrarCliente({ ...dados, endereco: 'SQS', aceites: vigentes('cliente') }), { codigo: 'ENDERECO' });
  const { perfil, cliente } = await casos.autocadastrarCliente({ ...dados, aceites: vigentes('cliente') });
  assert.equal(perfil.email, 'nova.cliente@gmail.com');
  assert.equal(perfil.clienteId, cliente.id);
  assert.equal((await infra.clientes.obter(cliente.id)).celular, '61998765432');
  assert.deepEqual(await casos.aceitesPendentes({ email: perfil.email, papel: 'cliente' }), []);
  assert.equal(infra.notificador.enviadas.at(-1).para, 'operacao');
  await assert.rejects(casos.autocadastrarCliente({ ...dados, aceites: vigentes('cliente') }), { codigo: 'JA_CADASTRADO' });
  const busca = await casos.buscarProfissionais({ regiao: 'Asa Sul' });
  assert.ok(busca.length > 0, 'já pode buscar e reservar');
});

test('quem já tinha acesso aceita os documentos uma vez, sem duplicar', async () => {
  const { casos } = montar();
  await casos.concederAcesso({ email: 'ana@x.com', papel: 'cliente', clienteId: 'c1' });
  assert.equal((await casos.aceitesPendentes({ email: 'ana@x.com', papel: 'cliente' })).length, 2);
  await assert.rejects(casos.registrarAceites({ email: 'ana@x.com', papel: 'cliente', aceites: { privacidade: DOCUMENTOS_LEGAIS.privacidade.versao } }), { codigo: 'ACEITE' });
  assert.deepEqual(await casos.registrarAceites({ email: 'ana@x.com', papel: 'cliente', aceites: vigentes('cliente') }), []);
  assert.deepEqual(await casos.registrarAceites({ email: 'ana@x.com', papel: 'cliente', aceites: vigentes('cliente') }), []);
});

test('servidor: sem perfil só se cadastra, com o e-mail do login; aceite é sempre de quem está logado', async () => {
  const [p] = await autorizar('autocadastrarCliente', [{ ...dados, email: 'outra@x.com' }], null, {}, 'eu@x.com');
  assert.equal(p.email, 'eu@x.com');
  await assert.rejects(autorizar('buscarProfissionais', [{}], null, {}, 'eu@x.com'), { name: 'SemPermissao', message: /cadastro/ });
  await assert.rejects(autorizar('autocadastrarCliente', [dados], null, {}, null), { name: 'SemPermissao' });
  const ana = { email: 'ana@x.com', papel: 'cliente', clienteId: 'c1' };
  const [a] = await autorizar('registrarAceites', [{ email: 'x@x.com', papel: 'operacao', aceites: { a: 1 } }], ana, {});
  assert.deepEqual(a, { email: 'ana@x.com', papel: 'cliente', aceites: { a: 1 } });
  const [o] = await autorizar('autocadastrarCliente', [{ ...dados }], { email: 'op@x.com', papel: 'operacao' }, {});
  assert.equal(o.email, 'op@x.com', 'operação não aceita termos em nome de outra pessoa');
});

test('servidor: reservar, comprar pacote e aceitar pedido exigem os termos vigentes aceitos', async () => {
  const { infra } = montar();
  const ana = { email: 'ana@x.com', papel: 'cliente', clienteId: 'c1' };
  await assert.rejects(autorizar('solicitarReserva', [{}], ana, infra), { name: 'SemPermissao', message: /Termos de uso para clientes/ });
  await assert.rejects(autorizar('comprarPacote', [{}], ana, infra), { name: 'SemPermissao' });
  assert.ok(await autorizar('minhasDiaristas', [], ana, infra), 'consultar continua livre');
  for (const [documento, versao] of Object.entries(vigentes('cliente'))) await infra.aceites.registrar({ email: 'ana@x.com', documento, versao, aceitoEm: HOJE });
  const [r] = await autorizar('solicitarReserva', [{ clienteId: 'c9' }], ana, infra);
  assert.equal(r.clienteId, 'c1');
  const marlene = { email: 'm@x.com', papel: 'diarista', diaristaId: 'd1' };
  await assert.rejects(autorizar('responderPedido', [{}], marlene, infra), { message: /profissionais/ });
});
