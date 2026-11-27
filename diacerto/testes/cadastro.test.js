import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCasosDeUso } from '../src/aplicacao/casos-de-uso.js';
import { criarInfraestruturaEmMemoria } from '../src/infraestrutura/memoria/index.js';
import { pendenciasDaCandidatura, novaCandidatura, nomePublico, iniciaisDe, reais } from '../src/dominio/index.js';

const HOJE = new Date(2026, 11, 1, 10); // terça
const montar = () => { const infra = criarInfraestruturaEmMemoria({ agora: HOJE }); return { infra, casos: criarCasosDeUso(infra) }; };
const tudoOk = { identidade: 'ok', certidao_pcdf: 'ok', certidao_pf: 'ok', referencia_1: 'ok', referencia_2: 'ok', conversa: 'ok' };

test('nova candidatura valida nome e celular', () => {
  assert.throws(() => novaCandidatura({ id: 'x', nome: 'Al', celular: '61999990000' }), { codigo: 'NOME' });
  assert.throws(() => novaCandidatura({ id: 'x', nome: 'Alice Silva', celular: '9999' }), { codigo: 'CELULAR' });
  assert.equal(novaCandidatura({ id: 'x', nome: ' Alice Silva ', celular: '(61) 99999-0000' }).celular, '61999990000');
});

test('nome público e iniciais preservam a privacidade', () => {
  assert.equal(nomePublico('Benedita Souza Lima'), 'Benedita L.');
  assert.equal(iniciaisDe('Benedita Souza Lima'), 'BL');
});

test('candidatura nova tem pendências de verificação, preços e aceite', () => {
  const p = pendenciasDaCandidatura(novaCandidatura({ id: 'x', nome: 'Alice Silva', celular: '61999990000' }));
  assert.ok(p.some((x) => x.includes('remuneração mínima')));
  assert.ok(p.some((x) => x.includes('Certidão de antecedentes da Polícia Federal')));
  assert.ok(p.includes('Registrar o aceite do código de conduta.'));
});

test('pedido de contato pelo site entra na fila da operação', async () => {
  const { casos, infra } = montar();
  const c = await casos.solicitarContato({ nome: 'Maria das Dores', celular: '61 98888-7777', regiao: 'Asa Norte' });
  assert.equal(c.status, 'contato');
  assert.equal(infra.notificador.enviadas.at(-1).para, 'operacao');
  const lista = await casos.listarCandidaturas();
  assert.equal(lista[0].status, 'contato');
});

test('aprovação exige tudo resolvido e cria a diarista com agenda', async () => {
  const { casos } = montar();
  await assert.rejects(casos.aprovarCandidatura('k2'), { codigo: 'PENDENCIAS' });
  await casos.atualizarCandidatura('k2', { verificacao: tudoOk });
  let c = await casos.registrarAceiteDaConduta('k2');
  assert.deepEqual(c.pendencias, []);
  const { diarista, candidatura } = await casos.aprovarCandidatura('k2');
  assert.equal(candidatura.status, 'aprovada');
  assert.equal(diarista.nome, 'Benedita L.');
  assert.ok(Object.keys(diarista.disponibilidade).length >= 8); // seg, qua, sex por 3 semanas
  const busca = await casos.buscarProfissionais({ regiao: 'Asa Sul' });
  const nova = busca.find((p) => p.id === diarista.id);
  assert.equal(nova.totalAvulso, reais(190) + reais(18) + reais(15));
  await assert.rejects(casos.atualizarCandidatura('k2', { naoFaz: 'x' }), { codigo: 'ENCERRADA' });
});

test('verificação reprovada bloqueia; reprovação exige motivo', async () => {
  const { casos } = montar();
  const c = await casos.atualizarCandidatura('k2', { verificacao: { ...tudoOk, certidao_pf: 'nao_aprovado' } });
  assert.ok(c.pendencias.some((x) => x.startsWith('Verificação não aprovada')));
  await assert.rejects(casos.reprovarCandidatura('k2', ''), { codigo: 'MOTIVO' });
  const r = await casos.reprovarCandidatura('k2', 'Certidão com pendência');
  assert.equal(r.status, 'reprovada');
});

test('preço abaixo do piso aparece como pendência', async () => {
  const { casos } = montar();
  const c = await casos.atualizarCandidatura('k1', { precos: { diaria: reais(100), meiaDiaria: reais(80), transporte: 0, descontoPacote: 0 } });
  assert.equal(c.status, 'em_cadastro');
  assert.ok(c.pendencias.includes('A diária está abaixo da remuneração mínima.'));
});

test('aprovação com e-mail libera o acesso da diarista', async () => {
  const { casos, infra } = montar();
  await casos.atualizarCandidatura('k2', { email: 'Benedita@Gmail.com', verificacao: tudoOk });
  await casos.registrarAceiteDaConduta('k2');
  const { diarista, acesso } = await casos.aprovarCandidatura('k2');
  assert.equal(acesso.email, 'benedita@gmail.com');
  assert.equal((await infra.perfis.porEmail('benedita@gmail.com')).diaristaId, diarista.id);
  await assert.rejects(casos.atualizarCandidatura('k1', { email: 'operacao@exemplo.com' }), { codigo: 'EMAIL_EM_USO' });
});
