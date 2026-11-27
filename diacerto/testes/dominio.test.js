import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reais, formatarReais, calcularAtendimento, validarPrecosDaDiarista,
  verificarLimiteSemanal, verificarJanela, calcularCancelamentoPeloCliente,
  novoAtendimento, mudarStatus, confirmarChegada, STATUS, RegraDeNegocioViolada,
} from '../src/dominio/index.js';

const base = { servico: reais(200), transporte: reais(20) };

test('avulso: cliente R$ 235, diarista R$ 180, plataforma R$ 55', () => {
  const v = calcularAtendimento({ ...base, modalidade: 'avulso' });
  assert.equal(v.totalCliente, reais(235));
  assert.equal(v.recebeDiarista, reais(180));
  assert.equal(v.receitaPlataforma, reais(55));
});

test('pacote com 10%: cliente R$ 212, diarista R$ 173, plataforma R$ 39', () => {
  const v = calcularAtendimento({ ...base, modalidade: 'pacote', descontoPacote: 0.10 });
  assert.equal(v.servico, reais(180));
  assert.equal(v.totalCliente, reais(212));
  assert.equal(v.recebeDiarista, reais(173));
  assert.equal(v.receitaPlataforma, reais(39));
});

test('cupom de lançamento R$ 30: cliente paga R$ 205 e a diarista continua com R$ 180', () => {
  const v = calcularAtendimento({ ...base, modalidade: 'avulso', cupom: reais(30) });
  assert.equal(v.totalCliente, reais(205));
  assert.equal(v.recebeDiarista, reais(180));
  assert.equal(v.receitaPlataforma, reais(25));
});

test('cupom nunca passa da receita da plataforma', () => {
  const v = calcularAtendimento({ ...base, modalidade: 'avulso', cupom: reais(500) });
  assert.equal(v.cupom, reais(55));
  assert.equal(v.receitaPlataforma, 0);
  assert.equal(v.recebeDiarista, reais(180));
});

test('comissão não incide sobre o transporte', () => {
  const semTransporte = calcularAtendimento({ servico: reais(200), transporte: 0, modalidade: 'avulso' });
  const comTransporte = calcularAtendimento({ ...base, modalidade: 'avulso' });
  assert.equal(semTransporte.comissao, comTransporte.comissao);
});

test('piso da diária e desconto máximo do pacote', () => {
  const ok = { diaria: reais(200), meiaDiaria: reais(110), transporte: reais(20), descontoPacote: 0.1 };
  assert.ok(validarPrecosDaDiarista(ok));
  assert.throws(() => validarPrecosDaDiarista({ ...ok, diaria: reais(120) }), { codigo: 'PISO_DIARIA' });
  assert.throws(() => validarPrecosDaDiarista({ ...ok, descontoPacote: 0.5 }), { codigo: 'DESCONTO_PACOTE' });
});

test('limite de 2 atendimentos por semana para a mesma dupla', () => {
  const seg = new Date(2026, 11, 7), qua = new Date(2026, 11, 9), sex = new Date(2026, 11, 11), segSeguinte = new Date(2026, 11, 14);
  assert.ok(verificarLimiteSemanal(qua, [seg]));
  assert.throws(() => verificarLimiteSemanal(sex, [seg, qua]), { codigo: 'LIMITE_SEMANAL' });
  assert.ok(verificarLimiteSemanal(segSeguinte, [seg, qua]));
});

test('janela de funcionamento das 7h às 20h', () => {
  assert.ok(verificarJanela(8, 17));
  assert.throws(() => verificarJanela(6, 10), RegraDeNegocioViolada);
  assert.throws(() => verificarJanela(15, 21), RegraDeNegocioViolada);
});

test('cancelamento: grátis com 24h, depois 50% do valor da diarista', () => {
  const at = { inicio: new Date(2026, 11, 8, 8), totalCliente: reais(235), recebeDiarista: reais(180) };
  const cedo = calcularCancelamentoPeloCliente(at, new Date(2026, 11, 6, 8));
  assert.deepEqual(cedo, { gratuito: true, reembolsoCliente: reais(235), devidoDiarista: 0 });
  const tarde = calcularCancelamentoPeloCliente(at, new Date(2026, 11, 7, 20));
  assert.equal(tarde.devidoDiarista, reais(90));
  assert.equal(tarde.reembolsoCliente, reais(145));
});

test('ciclo do atendimento e confirmação por código', () => {
  let a = novoAtendimento({ id: 'a1', codigoConfirmacao: '4821' });
  assert.equal(a.status, STATUS.SOLICITADO);
  assert.throws(() => mudarStatus(a, STATUS.CONCLUIDO), { codigo: 'TRANSICAO_INVALIDA' });
  a = mudarStatus(a, STATUS.ACEITO);
  assert.throws(() => confirmarChegada(a, '0000'), { codigo: 'CODIGO_INVALIDO' });
  a = confirmarChegada(a, '4821');
  assert.equal(a.status, STATUS.EM_ANDAMENTO);
});

test('formatação em reais', () => {
  assert.equal(formatarReais(reais(1433)), 'R$ 1.433,00');
  assert.equal(formatarReais(-reais(30)), '- R$ 30,00');
});
