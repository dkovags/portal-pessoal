import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCasosDeUso } from '../src/aplicacao/casos-de-uso.js';
import { criarInfraestruturaEmMemoria } from '../src/infraestrutura/memoria/index.js';
import { novaOcorrencia, resolverOcorrencia, margemDeContribuicao, calcularIndicadores, calcularAtendimento, reais } from '../src/dominio/index.js';

const HOJE = new Date(2026, 11, 1, 10);
const montar = () => { const infra = criarInfraestruturaEmMemoria({ agora: HOJE }); return { infra, casos: criarCasosDeUso(infra) }; };
const base = { id: 'x', atendimentoId: 'a1', abertoPor: 'cliente', descricao: 'Descrição suficiente do ocorrido.', abertaEm: HOJE };

test('ocorrência de segurança ou acidente é sempre grave', () => {
  assert.equal(novaOcorrencia({ ...base, tipo: 'seguranca', gravidade: 'leve' }).gravidade, 'grave');
  assert.throws(() => novaOcorrencia({ ...base, tipo: 'dano', gravidade: 'leve', descricao: 'curta' }), { codigo: 'DESCRICAO' });
});

test('reembolso respeita a política: dano até R$ 500, falta até o valor pago, demais sem reembolso', () => {
  const dano = novaOcorrencia({ ...base, tipo: 'dano', gravidade: 'moderada' });
  const r = { resolucao: 'Ouvidas as duas partes; reembolso aprovado.', totalPago: reais(235), agora: HOJE };
  assert.throws(() => resolverOcorrencia(dano, { ...r, reembolso: reais(600) }), { codigo: 'LIMITE_REEMBOLSO' });
  assert.equal(resolverOcorrencia(dano, { ...r, reembolso: reais(500) }).reembolso, reais(500));
  const falta = novaOcorrencia({ ...base, tipo: 'falta_diarista', gravidade: 'moderada' });
  assert.throws(() => resolverOcorrencia(falta, { ...r, reembolso: reais(300) }), { codigo: 'LIMITE_REEMBOLSO' });
  const atraso = novaOcorrencia({ ...base, tipo: 'atraso', gravidade: 'leve' });
  assert.throws(() => resolverOcorrencia(atraso, { ...r, reembolso: reais(10) }), { codigo: 'SEM_REEMBOLSO' });
});

test('margem de contribuição do avulso no Pix', () => {
  const valores = calcularAtendimento({ servico: reais(200), transporte: reais(20), modalidade: 'avulso' });
  // 55,00 - (0,99% de 235 = 2,33 + 1,00) - 6% de 55 (3,30) - 4 - 4 - 8
  assert.equal(margemDeContribuicao({ valores, metodo: 'pix' }), 3237);
});

test('indicadores: recompra, vazamento e cancelamento sobre dados controlados', () => {
  const v = calcularAtendimento({ servico: reais(200), transporte: reais(20), modalidade: 'avulso' });
  const at = (id, c, d, diasAtras, status) => ({ id, clienteId: c, diaristaId: d, status, metodo: 'pix', valores: v,
    inicio: new Date(HOJE.getTime() - diasAtras * 864e5), concluidoEm: status === 'concluido' ? new Date(HOJE.getTime() - diasAtras * 864e5) : undefined });
  const atendimentos = [
    at('1', 'A', 'X', 60, 'concluido'), at('2', 'A', 'X', 50, 'concluido'), // A voltou em 10 dias; par A-X sumiu há 50 dias
    at('3', 'B', 'X', 45, 'concluido'), // B não voltou
    at('4', 'C', 'Y', 40, 'concluido'), at('5', 'C', 'Y', 5, 'concluido'), // C voltou depois de 35 dias (fora da janela); par ativo
    at('6', 'D', 'Y', 3, 'cancelado'),
  ];
  const r = calcularIndicadores({ atendimentos, ocorrencias: [], agora: HOJE });
  const ind = Object.fromEntries(r.indicadores.map((i) => [i.id, i]));
  assert.equal(ind.recompra.valor, 1 / 3);
  assert.equal(ind.recompra.faixa, 'amarelo');
  assert.equal(ind.vazamento.valor, 1 / 2);
  assert.equal(ind.vazamento.faixa, 'vermelho');
  assert.equal(ind.cancelamento.valor, 1 / 6);
  assert.equal(ind.margem.valor, 3237);
  assert.equal(ind.margem.faixa, 'verde');
});

test('operação: registrar e resolver ocorrência com reembolso pelo provedor', async () => {
  const { casos, infra } = montar();
  const abertas = await casos.listarOcorrencias({ status: 'aberta' });
  assert.equal(abertas[0].id, 'o1');
  await assert.rejects(casos.resolverOcorrencia({ ocorrenciaId: 'o1', resolucao: 'curta', reembolso: 0 }), { codigo: 'RESOLUCAO' });
  const r = await casos.resolverOcorrencia({ ocorrenciaId: 'o1', resolucao: 'Ouvimos cliente e profissional; reembolso do vaso.', reembolso: reais(120) });
  assert.equal(r.status, 'resolvida');
  const estorno = infra.pagamento.registro.find((x) => x.tipo === 'estorno');
  assert.equal(estorno.valor, reais(120));
  const nova = await casos.registrarOcorrencia({ atendimentoId: 'a7', tipo: 'seguranca', gravidade: 'leve', abertoPor: 'diarista', descricao: 'Cliente fez comentários constrangedores.' });
  assert.equal(nova.gravidade, 'grave');
  assert.equal(infra.notificador.enviadas.at(-1).para, 'operacao');
});

test('operação: lista de atendimentos com nomes e filtro', async () => {
  const { casos } = montar();
  const pendentes = await casos.listarAtendimentosOperacao({ status: 'solicitado' });
  assert.equal(pendentes.length, 1);
  assert.equal(pendentes[0].clienteNome, 'Carlos M.');
  const ind = await casos.indicadoresDoPiloto();
  assert.equal(ind.indicadores.length, 6);
});
