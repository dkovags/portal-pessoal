// RF01 a RF03: endereço só depois do aceite, imóvel e escopo do pedido, conclusão com prazo para contestar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCasosDeUso } from '../src/aplicacao/casos-de-uso.js';
import { criarInfraestruturaEmMemoria } from '../src/infraestrutura/memoria/index.js';
import {
  localVisivelParaDiarista, fimDoDia, novoImovel, novoEscopo, concluirPelaDiarista, confirmarConclusao,
  contestarConclusao, repasseVencido, decidirRepasse, reais,
} from '../src/dominio/index.js';

const HOJE = new Date(2026, 11, 1, 10); // terça, 1º/12/2026
function montar(agora = HOJE) {
  const infra = criarInfraestruturaEmMemoria({ agora });
  return { infra, casos: criarCasosDeUso(infra) };
}
const em = (infra, agora) => criarCasosDeUso({ ...infra, relogio: { agora: () => new Date(agora) } });
const livres = async (casos, id) => (await casos.obterPerfil(id)).proximosHorarios.map((h) => h.data);
const pedido = (extra = {}) => ({ clienteId: 'c2', diaristaId: 'd3', horaInicio: 10, duracao: 'diaria', modalidade: 'avulso', metodo: 'pix', ...extra });

test('domínio: local visível só depois do aceite e até o fim do dia', () => {
  const a = { status: 'aceito', inicio: new Date(2026, 11, 3, 8) };
  assert.equal(localVisivelParaDiarista(a, HOJE), true);
  assert.equal(localVisivelParaDiarista({ ...a, status: 'solicitado' }, HOJE), false);
  assert.equal(localVisivelParaDiarista({ ...a, status: 'recusado' }, HOJE), false);
  assert.equal(localVisivelParaDiarista({ ...a, status: 'concluido' }, new Date(2026, 11, 3, 23, 59)), true);
  assert.equal(localVisivelParaDiarista({ ...a, status: 'concluido' }, fimDoDia(a.inicio)), false);
});

test('domínio: imóvel e escopo dentro do que a profissional faz', () => {
  assert.deepEqual(novoImovel({ tipo: 'casa', quartos: '3', banheiros: 2, animais: ' 2 cães ' }), { tipo: 'casa', quartos: 3, banheiros: 2, animais: '2 cães' });
  assert.throws(() => novoImovel({ tipo: 'sítio', quartos: 1, banheiros: 1 }), { codigo: 'IMOVEL' });
  assert.throws(() => novoImovel({ tipo: 'casa', quartos: 1, banheiros: 0 }), { codigo: 'IMOVEL' });
  const rosa = { tarefas: ['Limpeza geral', 'Passar roupas leves'], levaMateriais: false };
  assert.deepEqual(novoEscopo({ tarefas: ['Limpeza geral', 'Limpeza geral'] }, rosa), { tarefas: ['Limpeza geral'], materiais: 'cliente' });
  assert.throws(() => novoEscopo({ tarefas: [] }, rosa), { codigo: 'TAREFAS' });
  assert.throws(() => novoEscopo({ tarefas: ['Cozinha'] }, rosa), { codigo: 'TAREFAS', message: /Cozinha/ });
  assert.throws(() => novoEscopo({ tarefas: ['Limpeza geral'], materiais: 'profissional' }, rosa), { codigo: 'MATERIAIS' });
});

test('domínio: conclusão espera confirmação; vence o prazo ou a operação decide', () => {
  const a = { status: 'em_andamento', inicio: new Date(2026, 11, 1, 8) };
  const c = concluirPelaDiarista(a, HOJE, 24);
  assert.equal(c.repasse.status, 'aguardando');
  assert.equal(confirmarConclusao(c, HOJE).repasse.origem, 'cliente');
  assert.throws(() => confirmarConclusao(c, new Date(2026, 11, 2, 10)), { codigo: 'PRAZO_CONTESTACAO' });
  assert.equal(repasseVencido(c, new Date(2026, 11, 2, 10)), true);
  const contestado = contestarConclusao(c, HOJE);
  assert.equal(repasseVencido(contestado, new Date(2026, 11, 9)), false, 'contestado não vence sozinho');
  assert.equal(decidirRepasse(contestado, 'reter', HOJE).repasse.status, 'retido');
  assert.throws(() => decidirRepasse(c, 'liberar', HOJE), { codigo: 'REPASSE' });
});

test('RF01: a diarista vê endereço e instruções só depois de aceitar, e só até o fim do dia', async () => {
  const { casos, infra } = montar();
  const [dia] = await livres(casos, 'd3');
  const a = await casos.solicitarReserva(pedido({ data: dia, instrucoes: 'Chave na portaria, em nome de Carlos.' }));
  const antes = await casos.painelDiarista('d3');
  const noPedido = antes.pendentes.find((x) => x.id === a.id);
  assert.equal(noPedido.local, undefined);
  assert.equal(noPedido.clienteRegiao, 'Asa Sul');
  assert.ok(!JSON.stringify(antes).includes('SQS 308'), 'nenhum endereço antes do aceite');
  const aceito = await casos.responderPedido({ atendimentoId: a.id, diaristaId: 'd3', aceitar: true });
  assert.ok(!JSON.stringify(aceito).includes('portaria'), 'o local não viaja com o atendimento');
  const depois = await casos.painelDiarista('d3');
  assert.deepEqual(depois.agendados.find((x) => x.id === a.id).local, { endereco: 'SQS 308, Bloco [X], apto [Y]', instrucoes: 'Chave na portaria, em nome de Carlos.' });
  const noDiaSeguinte = await em(infra, fimDoDia(a.inicio)).painelDiarista('d3');
  assert.ok(!JSON.stringify(noDiaSeguinte).includes('portaria'));
});

test('RF01: recusa nunca mostra o endereço; o cliente muda as instruções até o atendimento começar', async () => {
  const { casos, infra } = montar();
  const [dia] = await livres(casos, 'd3');
  const a = await casos.solicitarReserva(pedido({ data: dia }));
  const local = await casos.atualizarInstrucoesDeAcesso({ atendimentoId: a.id, clienteId: 'c2', instrucoes: 'Interfone 302.' });
  assert.equal(local.instrucoes, 'Interfone 302.');
  await assert.rejects(casos.atualizarInstrucoesDeAcesso({ atendimentoId: a.id, clienteId: 'c1', instrucoes: 'x' }), { codigo: 'NAO_ENCONTRADO' });
  await assert.rejects(casos.atualizarInstrucoesDeAcesso({ atendimentoId: a.id, clienteId: 'c2', instrucoes: 'x'.repeat(301) }), { codigo: 'INSTRUCOES' });
  const proximo = (await casos.minhasDiaristas('c2')).find((x) => x.diarista.id === 'd3').proximo;
  assert.equal(proximo.local.instrucoes, 'Interfone 302.');
  await casos.responderPedido({ atendimentoId: a.id, diaristaId: 'd3', aceitar: false });
  assert.ok(!JSON.stringify(await casos.painelDiarista('d3')).includes('Interfone'));
  await assert.rejects(casos.atualizarInstrucoesDeAcesso({ atendimentoId: a.id, clienteId: 'c2', instrucoes: 'y' }), { codigo: 'NAO_EDITAVEL' });
  assert.equal((await casos.obterAtendimentoOperacao(a.id)).local.instrucoes, 'Interfone 302.', 'a operação vê');
  assert.equal(infra.notificador.enviadas.filter((m) => /instruções/.test(m.texto)).length, 0, 'sem aviso antes do aceite');
});

test('RF02: pedido guarda imóvel, tarefas e materiais; o imóvel fica lembrado', async () => {
  const { casos, infra } = montar();
  const [dia] = await livres(casos, 'd1');
  const imovel = { tipo: 'apartamento', quartos: 4, banheiros: 3, animais: '1 gato' };
  await assert.rejects(casos.solicitarReserva(pedido({ diaristaId: 'd1', data: dia, horaInicio: 8, tarefas: ['Passar roupas leves'] })), { codigo: 'TAREFAS' });
  const a = await casos.solicitarReserva(pedido({ diaristaId: 'd1', data: dia, horaInicio: 8, imovel, tarefas: ['Cozinha', 'Banheiros'], materiais: 'profissional' }));
  assert.deepEqual([a.imovel, a.tarefas, a.materiais], [imovel, ['Cozinha', 'Banheiros'], 'profissional']);
  assert.deepEqual((await casos.meusDados({ clienteId: 'c2' })).imovel, imovel);
  assert.equal((await casos.painelDiarista('d1')).pendentes.find((x) => x.id === a.id).tarefas.length, 2, 'a diarista vê o escopo antes de aceitar');
  await casos.atualizarPreferencias('d1', { levaMateriais: false });
  assert.equal((await casos.obterPerfil('d1')).levaMateriais, false);
  const semImovel = { ...(await infra.clientes.obter('c3')), imovel: null };
  await infra.clientes.salvar(semImovel);
  const [diaRosa] = await livres(casos, 'd3');
  await assert.rejects(casos.solicitarReserva(pedido({ clienteId: 'c3', data: diaRosa })), { codigo: 'IMOVEL' });
});

test('RF03: concluir não paga; o cliente confirma e o repasse sai na hora', async () => {
  const { casos, infra } = montar();
  const [dia] = await livres(casos, 'd3');
  const a = await casos.solicitarReserva(pedido({ data: dia }));
  await casos.responderPedido({ atendimentoId: a.id, diaristaId: 'd3', aceitar: true });
  const noDia = em(infra, new Date(a.inicio.getTime() + 8 * 36e5));
  await noDia.confirmarChegada({ atendimentoId: a.id, codigo: a.codigoConfirmacao });
  const c = await noDia.concluirAtendimento({ atendimentoId: a.id });
  assert.equal(c.repasse.status, 'aguardando');
  assert.ok(!infra.pagamento.registro.some((r) => r.tipo === 'captura' && r.idempotencia === `repasse:${a.id}`));
  assert.match(infra.notificador.enviadas.at(-1).texto, /24 horas/);
  const pendentes = await noDia.conclusoesParaConfirmar({ clienteId: 'c2' });
  assert.deepEqual(pendentes.map((x) => x.id), [a.id]);
  assert.equal((await noDia.painelDiarista('d3')).aLiberar.length, 1);
  await assert.rejects(noDia.confirmarConclusao({ atendimentoId: a.id, clienteId: 'c1' }), { codigo: 'NAO_ENCONTRADO' });
  await noDia.confirmarConclusao({ atendimentoId: a.id, clienteId: 'c2' });
  assert.equal(infra.pagamento.registro.filter((r) => r.tipo === 'captura' && r.idempotencia === `repasse:${a.id}`).length, 1);
  const painel = await noDia.painelDiarista('d3');
  assert.equal(painel.aLiberar.length, 0);
  assert.ok(painel.ultimosRecebimentos.some((x) => x.id === a.id));
  await assert.rejects(noDia.confirmarConclusao({ atendimentoId: a.id, clienteId: 'c2' }), { codigo: 'SEM_CONFIRMACAO_PENDENTE' });
});

test('RF03: sem resposta em 24 horas o repasse é liberado uma vez só', async () => {
  const { casos, infra } = montar();
  const [pendente] = await casos.conclusoesParaConfirmar({ clienteId: 'c1' }); // a10, semeado aguardando
  assert.ok(pendente);
  const depois = em(infra, new Date(pendente.liberarEm.getTime() + 60e3));
  assert.deepEqual(await depois.conclusoesParaConfirmar({ clienteId: 'c1' }), []);
  await depois.painelDiarista('d3');
  await depois.listarAtendimentosOperacao({ status: 'todos' });
  const capturas = infra.pagamento.registro.filter((r) => r.tipo === 'captura' && r.idempotencia === `repasse:${pendente.id}`);
  assert.equal(capturas.length, 1);
  const a = await infra.atendimentos.obter(pendente.id);
  assert.deepEqual([a.repasse.status, a.repasse.origem], ['liberado', 'prazo']);
  assert.equal((await depois.painelDiarista('d3')).ultimosRecebimentos[0].id, pendente.id);
});

test('RF03: contestar abre ocorrência e segura o repasse até a operação decidir', async () => {
  const { casos, infra } = montar();
  const [p] = await casos.conclusoesParaConfirmar({ clienteId: 'c1' });
  await assert.rejects(casos.contestarConclusao({ atendimentoId: p.id, clienteId: 'c1', tipo: 'falta_diarista', descricao: 'Ela não veio ao atendimento.' }), { codigo: 'TIPO' });
  const { ocorrencia } = await casos.contestarConclusao({ atendimentoId: p.id, clienteId: 'c1', tipo: 'qualidade', descricao: 'Os banheiros não foram limpos.' });
  assert.equal(ocorrencia.contestacao, true);
  assert.equal((await casos.painelDiarista('d3')).emAnalise.length, 1);
  const muitoDepois = em(infra, new Date(2026, 11, 20));
  await muitoDepois.listarAtendimentosOperacao({ status: 'todos' });
  assert.ok(!infra.pagamento.registro.some((r) => r.tipo === 'captura'), 'contestado não libera pelo prazo');
  await assert.rejects(casos.resolverOcorrencia({ ocorrenciaId: ocorrencia.id, resolucao: 'Ouvidas as duas partes por telefone.' }), { codigo: 'REPASSE' });
  const r = await casos.resolverOcorrencia({ ocorrenciaId: ocorrencia.id, resolucao: 'Ouvidas as duas partes; serviço feito, faltou um banheiro.', repasse: 'liberar' });
  assert.equal(r.repasse, 'liberado');
  assert.equal(infra.pagamento.registro.filter((x) => x.tipo === 'captura').length, 1);
  assert.match(infra.notificador.enviadas.at(-1).texto, /liberado/);
});

test('RF03: reter devolve ao cliente; pedir ajuda no prazo também contesta', async () => {
  const { casos, infra } = montar();
  const [p] = await casos.conclusoesParaConfirmar({ clienteId: 'c1' });
  const o = await casos.registrarOcorrencia({ atendimentoId: p.id, tipo: 'qualidade', gravidade: 'moderada', abertoPor: 'cliente', descricao: 'Ela foi embora na metade do horário.' });
  assert.equal(o.contestacao, true);
  assert.equal((await infra.atendimentos.obter(p.id)).repasse.status, 'contestado');
  await assert.rejects(casos.resolverOcorrencia({ ocorrenciaId: o.id, resolucao: 'Confirmado pelas duas partes.', repasse: 'reter', reembolso: reais(10) }), { codigo: 'SEM_REEMBOLSO' });
  const r = await casos.resolverOcorrencia({ ocorrenciaId: o.id, resolucao: 'Confirmado pelas duas partes: serviço não foi feito.', repasse: 'reter' });
  assert.equal(r.repasse, 'retido');
  const estorno = infra.pagamento.registro.at(-1);
  assert.deepEqual([estorno.tipo, estorno.motivo], ['estorno', `repasse-retido:${p.id}`]);
  const daDiarista = await casos.registrarOcorrencia({ atendimentoId: 'a7', tipo: 'outro', gravidade: 'leve', abertoPor: 'diarista', descricao: 'Cliente pediu tarefas fora do combinado.' });
  assert.equal(daDiarista.contestacao, false);
});
