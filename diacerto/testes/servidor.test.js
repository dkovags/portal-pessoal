// Servidor: casos de uso sobre Postgres real (local) e a API com login e permissões.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { conexaoTeste, prepararBanco, executorPsql, psql } from './postgres-local.js';
import { criarInfraestruturaPostgres } from '../src/infraestrutura/postgres/index.js';
import { criarCasosDeUso } from '../src/aplicacao/casos-de-uso.js';
import { criarServidor } from '../src/apresentacao/api/servidor.js';
import { verificadorJwt, TokenInvalido } from '../src/apresentacao/api/jwt.js';
import { reais } from '../src/dominio/index.js';

const pular = !conexaoTeste && 'defina DIACERTO_PG para rodar contra um Postgres local';
const BANCO = 'diacerto_teste';
let dep; let casos; let api;

const PERFIS = { 'op@x.com': 'operacao', 'ana@x.com': 'cliente', 'marlene@x.com': 'diarista' };
const pedir = (caminho, { token, args, metodo = 'POST', origem = 'https://pessoal.kovags.com' } = {}) => api.fetch(new Request(`https://api.teste${caminho}`, {
  method: metodo, headers: { origin: origem, ...(token ? { authorization: `Bearer ${token}` } : {}) },
  ...(metodo === 'POST' ? { body: JSON.stringify({ args }) } : {}),
}));
const corpo = async (r) => ({ status: r.status, ...(await r.json()) });

before(() => {
  if (pular) return;
  prepararBanco(BANCO);
  psql(BANCO, `insert into diacerto.perfis (email, papel, cliente_id, diarista_id) values
    ('op@x.com','operacao',null,null), ('ana@x.com','cliente','c1',null), ('marlene@x.com','diarista',null,'d1')`);
  dep = criarInfraestruturaPostgres(executorPsql(BANCO));
  casos = criarCasosDeUso(dep);
  api = criarServidor({ casos, dep, origens: ['https://pessoal.kovags.com'], registrar: () => {},
    verificarToken: async (t) => { if (!PERFIS[t] && t !== 'sem@x.com') throw new TokenInvalido('token de teste inválido'); return { sub: t, email: t }; } });
});

test('postgres: busca, perfil e reserva com cupom gravada com valores coerentes', { skip: pular }, async () => {
  const lista = await casos.buscarProfissionais({ regiao: 'Asa Norte' });
  assert.equal(lista.find((p) => p.id === 'd1').totalAvulso, reais(235));
  const perfil = await casos.obterPerfil('d3');
  assert.equal(perfil.avaliacoes.length, 0);
  const a = await casos.solicitarReserva({ clienteId: 'c2', diaristaId: 'd3', data: perfil.proximosHorarios[0].data, horaInicio: 10, duracao: 'diaria', modalidade: 'avulso', metodo: 'pix', codigoCupom: 'lancamento' });
  const [linha] = await executorPsql(BANCO).consultar('select * from diacerto.atendimentos where id = $1', [a.id]);
  assert.equal(linha.total_cliente, reais(180));
  await casos.responderPedido({ atendimentoId: a.id, diaristaId: 'd3', aceitar: true });
  await casos.confirmarChegada({ atendimentoId: a.id, codigo: a.codigoConfirmacao });
  await casos.concluirAtendimento({ atendimentoId: a.id });
  const eventos = await executorPsql(BANCO).consultar("select tipo from diacerto.eventos where tipo like 'pagamento%' order by id");
  assert.deepEqual(eventos.map((e) => e.tipo), ['pagamento.autorizacao', 'pagamento.captura']);
});

test('postgres: agenda, preços, cadastro aprovado e ocorrência com reembolso', { skip: pular }, async () => {
  await casos.atualizarPrecos('d1', { diaria: reais(210), meiaDiaria: reais(115), transporte: reais(20), descontoPacote: 0.1 });
  assert.equal((await dep.diaristas.obter('d1')).precos.diaria, reais(210));
  const painel = await casos.painelDiarista('d1');
  const dia = Object.keys(painel.diarista.disponibilidade).sort().at(-1);
  await casos.definirDisponibilidade('d1', dia, null);
  assert.ok(!(await dep.diaristas.obter('d1')).disponibilidade[dia]);
  await casos.atualizarCandidatura('k2', { verificacao: { referencia_2: 'ok', conversa: 'ok' } });
  await casos.registrarAceiteDaConduta('k2');
  const { diarista } = await casos.aprovarCandidatura('k2');
  assert.equal((await dep.diaristas.obter(diarista.id)).nome, 'Benedita L.');
  const r = await casos.resolverOcorrencia({ ocorrenciaId: 'o1', resolucao: 'Ouvidas as duas partes; reembolso aprovado.', reembolso: reais(150) });
  assert.equal(r.status, 'resolvida');
  const ind = await casos.indicadoresDoPiloto();
  assert.equal(ind.indicadores.length, 6);
});

test('postgres: o banco recusa valores incoerentes mesmo vindos do servidor', { skip: pular }, async () => {
  const a = await dep.atendimentos.obter('a8');
  await assert.rejects(dep.atendimentos.salvar({ ...a, valores: { ...a.valores, totalCliente: 100 } }));
});

test('api: sem login só o pedido de contato é público', { skip: pular }, async () => {
  assert.equal((await pedir('/casos/buscarProfissionais', { args: [{}] })).status, 403);
  const r = await corpo(await pedir('/casos/solicitarContato', { args: [{ nome: 'Rita Gomes', celular: '61977776666', regiao: 'Asa Sul' }] }));
  assert.equal(r.status, 200);
  assert.equal(r.resultado.status, 'contato');
});

test('api: cliente só age como ele mesmo', { skip: pular }, async () => {
  const eu = await corpo(await pedir('/eu', { token: 'ana@x.com', metodo: 'GET' }));
  assert.deepEqual([eu.resultado.papel, eu.resultado.clienteId], ['cliente', 'c1']);
  const minhas = await corpo(await pedir('/casos/minhasDiaristas', { token: 'ana@x.com', args: ['c2'] }));
  assert.ok(minhas.resultado.every((x) => x.diarista.id !== 'd3' || x.vezes >= 0)); // trocou c2 por c1
  assert.equal(minhas.resultado[0].diarista.id, 'd1');
  assert.equal((await pedir('/casos/listarCandidaturas', { token: 'ana@x.com', args: [] })).status, 403);
  assert.equal((await pedir('/casos/painelDiarista', { token: 'ana@x.com', args: ['d1'] })).status, 403);
});

test('api: diarista só responde aos próprios pedidos; regras viram 422', { skip: pular }, async () => {
  const r = await corpo(await pedir('/casos/atualizarPrecos', { token: 'marlene@x.com', args: ['d2', { diaria: reais(100), meiaDiaria: reais(100), transporte: 0, descontoPacote: 0 }] }));
  assert.equal(r.status, 422);
  assert.equal(r.erro.codigo, 'PISO_DIARIA');
  const alheio = await pedir('/casos/concluirAtendimento', { token: 'marlene@x.com', args: [{ atendimentoId: 'a9' }] });
  assert.equal(alheio.status, 403);
});

test('api: origem, rota, token e operação desconhecida', { skip: pular }, async () => {
  assert.equal((await pedir('/casos/buscarProfissionais', { origem: 'https://malicioso.example', args: [] })).status, 403);
  assert.equal((await pedir('/casos/constructor', { token: 'op@x.com', args: [] })).status, 404);
  assert.equal((await pedir('/casos/buscarProfissionais', { token: 'falso', args: [] })).status, 401);
  const semPerfil = await corpo(await pedir('/eu', { token: 'sem@x.com', metodo: 'GET' }));
  assert.equal(semPerfil.resultado.papel, null);
  const datas = await corpo(await pedir('/casos/minhasDiaristas', { token: 'op@x.com', args: ['c1'] }));
  assert.match(datas.resultado[0].ultima, /^\d{4}-\d{2}-\d{2}T/);
});

test('jwt: verifica assinatura Ed25519, validade e emissor', async () => {
  const { privateKey, publicKey } = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1' };
  const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const assinar = async (payload) => {
    const base = `${b64({ alg: 'EdDSA', kid: 'k1' })}.${b64(payload)}`;
    const sig = Buffer.from(await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, new TextEncoder().encode(base))).toString('base64url');
    return `${base}.${sig}`;
  };
  const verificar = verificadorJwt({ jwksUrl: 'https://auth/jwks', emissor: 'https://auth.example/neondb/auth',
    fetch: async () => new Response(JSON.stringify({ keys: [jwk] })) });
  const agora = Math.floor(Date.now() / 1000);
  const p = await verificar(await assinar({ sub: 'u1', email: 'a@b.c', exp: agora + 600, iss: 'https://auth.example' }));
  assert.equal(p.sub, 'u1');
  await assert.rejects(verificar(await assinar({ sub: 'u1', exp: agora - 600 })), /expirada/);
  await assert.rejects(verificar(await assinar({ sub: 'u1', exp: agora + 600, iss: 'https://outro.example' })), /Emissor/);
  const valido = await assinar({ sub: 'u1', exp: agora + 600 });
  const adulterado = valido.replace(/\.([^.]+)\./, (_, c) => `.${b64({ sub: 'admin', exp: agora + 600 })}.`);
  await assert.rejects(verificar(adulterado), /Assinatura/);
});

test('api: operação cadastra cliente com acesso, vincula diarista e não remove a si mesma', { skip: pular }, async () => {
  const novo = await corpo(await pedir('/casos/cadastrarCliente', { token: 'op@x.com', args: [{ nome: 'Fernanda Reis', endereco: 'SQN 312, Bloco A, apto 101', regiao: 'Asa Norte', email: 'Fernanda@X.com' }] }));
  assert.equal(novo.status, 200);
  assert.equal((await dep.perfis.porEmail('fernanda@x.com')).clienteId, novo.resultado.id);
  const dup = await corpo(await pedir('/casos/concederAcesso', { token: 'op@x.com', args: [{ email: 'fernanda@x.com', papel: 'diarista', diaristaId: 'd2' }] }));
  assert.equal(dup.erro.codigo, 'EMAIL_EM_USO');
  const vinc = await corpo(await pedir('/casos/concederAcesso', { token: 'op@x.com', args: [{ email: 'joana@x.com', papel: 'diarista', diaristaId: 'd2' }] }));
  assert.equal(vinc.status, 200);
  const lista = await corpo(await pedir('/casos/listarAcessos', { token: 'op@x.com', args: [] }));
  assert.ok(lista.resultado.perfis.some((p) => p.email === 'joana@x.com' && p.nome === 'Joana P.'));
  assert.ok(!lista.resultado.diaristasSemAcesso.some((d) => d.id === 'd2'));
  const proprio = await corpo(await pedir('/casos/removerAcesso', { token: 'op@x.com', args: [{ email: 'op@x.com' }] }));
  assert.equal(proprio.erro.codigo, 'PROPRIO');
  assert.equal((await pedir('/casos/cadastrarCliente', { token: 'ana@x.com', args: [{}] })).status, 403);
  const rem = await corpo(await pedir('/casos/removerAcesso', { token: 'op@x.com', args: [{ email: 'joana@x.com' }] }));
  assert.equal(rem.status, 200);
});

test('api: avaliações gravadas no Postgres e restritas a quem participou', { skip: pular }, async () => {
  const pend = await corpo(await pedir('/casos/pendentesDeAvaliacao', { token: 'ana@x.com', args: [{ clienteId: 'c2' }] }));
  const alvo = pend.resultado.find((x) => x.com === 'Marlene S.');
  assert.ok(alvo);
  const ok = await corpo(await pedir('/casos/avaliarProfissional', { token: 'ana@x.com', args: [{ atendimentoId: alvo.atendimentoId, clienteId: 'c2', nota: 4, comentario: 'Muito boa' }] }));
  assert.equal(ok.status, 200);
  const perfil = await casos.obterPerfil('d1');
  assert.equal(perfil.avaliacoes[0].texto, 'Muito boa');
  const de_novo = await corpo(await pedir('/casos/avaliarProfissional', { token: 'ana@x.com', args: [{ atendimentoId: alvo.atendimentoId, nota: 5 }] }));
  assert.equal(de_novo.erro.codigo, 'JA_AVALIADO');
  const alheio = await corpo(await pedir('/casos/avaliarCliente', { token: 'marlene@x.com', args: [{ atendimentoId: 'a5', nota: 3 }] }));
  assert.equal(alheio.erro.codigo, 'NAO_ENCONTRADO'); // a5 é da Joana
  const daMarlene = await corpo(await pedir('/casos/avaliarCliente', { token: 'marlene@x.com', args: [{ atendimentoId: alvo.atendimentoId, nota: 5 }] }));
  assert.equal(daMarlene.status, 200);
  const lados = await casos.avaliacoesDoAtendimento(alvo.atendimentoId);
  assert.deepEqual([lados.doCliente.nota, lados.daDiarista.nota], [4, 5]);
});
