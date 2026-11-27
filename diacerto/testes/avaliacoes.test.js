import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCasosDeUso } from '../src/aplicacao/casos-de-uso.js';
import { criarInfraestruturaEmMemoria } from '../src/infraestrutura/memoria/index.js';
import { novaAvaliacao } from '../src/dominio/index.js';

const HOJE = new Date(2026, 11, 1, 10);
const montar = () => { const infra = criarInfraestruturaEmMemoria({ agora: HOJE }); return { infra, casos: criarCasosDeUso(infra) }; };

test('avaliação: só concluído, nota inteira de 1 a 5, uma vez e dentro do prazo', () => {
  const at = { id: 'a', status: 'concluido', concluidoEm: new Date(2026, 10, 25), inicio: new Date(2026, 10, 25) };
  const ok = novaAvaliacao({ atendimento: at, lado: 'cliente', nota: 5, comentario: '  Ótima  ', agora: HOJE, jaAvaliado: false });
  assert.equal(ok.comentario, 'Ótima');
  assert.throws(() => novaAvaliacao({ atendimento: { ...at, status: 'aceito' }, lado: 'cliente', nota: 5, agora: HOJE }), { codigo: 'NAO_CONCLUIDO' });
  assert.throws(() => novaAvaliacao({ atendimento: at, lado: 'cliente', nota: 4.5, agora: HOJE }), { codigo: 'NOTA' });
  assert.throws(() => novaAvaliacao({ atendimento: at, lado: 'cliente', nota: 4, agora: HOJE, jaAvaliado: true }), { codigo: 'JA_AVALIADO' });
  assert.throws(() => novaAvaliacao({ atendimento: at, lado: 'cliente', nota: 4, agora: new Date(2027, 0, 30) }), { codigo: 'PRAZO_AVALIACAO' });
});

test('cliente avalia a profissional e a nota aparece no perfil, sem identificar o cliente', async () => {
  const { casos } = montar();
  const pend = await casos.pendentesDeAvaliacao({ clienteId: 'c1' });
  assert.ok(pend.length >= 1);
  const alvo = pend.find((p) => p.com === 'Marlene S.');
  const antes = (await casos.obterPerfil('d1')).avaliacoes.length;
  await casos.avaliarProfissional({ atendimentoId: alvo.atendimentoId, clienteId: 'c1', nota: 5, comentario: 'Caprichosa como sempre' });
  const perfil = await casos.obterPerfil('d1');
  assert.equal(perfil.avaliacoes.length, antes + 1);
  assert.equal(perfil.avaliacoes[0].texto, 'Caprichosa como sempre');
  assert.match(perfil.avaliacoes[0].autor, /^Cliente da região Asa Norte$/);
  assert.ok(!(await casos.pendentesDeAvaliacao({ clienteId: 'c1' })).some((p) => p.atendimentoId === alvo.atendimentoId));
  await assert.rejects(casos.avaliarProfissional({ atendimentoId: alvo.atendimentoId, clienteId: 'c1', nota: 4 }), { codigo: 'JA_AVALIADO' });
  await assert.rejects(casos.avaliarProfissional({ atendimentoId: alvo.atendimentoId, clienteId: 'c2', nota: 4 }), { codigo: 'NAO_ENCONTRADO' });
});

test('profissional avalia o cliente (interna) e a operação vê os dois lados', async () => {
  const { casos } = montar();
  const [p] = await casos.pendentesDeAvaliacao({ diaristaId: 'd1' });
  await casos.avaliarCliente({ atendimentoId: p.atendimentoId, diaristaId: 'd1', nota: 2, comentario: 'Não deixou os produtos' });
  const lados = await casos.avaliacoesDoAtendimento(p.atendimentoId);
  assert.equal(lados.daDiarista.nota, 2);
  assert.equal(lados.doCliente, null);
});
