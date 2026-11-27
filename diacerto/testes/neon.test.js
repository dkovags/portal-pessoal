// Os casos de uso rodando sobre os adaptadores Neon (com banco falso) dão os mesmos resultados da memória.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoFalso } from './banco-falso.js';
import { criarInfraestruturaNeon } from '../src/infraestrutura/neon/index.js';
import { criarCasosDeUso } from '../src/aplicacao/casos-de-uso.js';
import { gerarDadosFicticios } from '../src/infraestrutura/memoria/dados-ficticios.js';
import { linhaDeDiarista, linhaDeAtendimento, linhaDePacote } from '../src/infraestrutura/neon/mapeamento.js';
import { reais, STATUS } from '../src/dominio/index.js';

function montar() {
  const f = gerarDadosFicticios(new Date());
  const db = bancoFalso({
    clientes: f.clientes,
    diaristas: f.diaristas.map(linhaDeDiarista),
    disponibilidade: f.diaristas.flatMap((d) => Object.entries(d.disponibilidade).map(([data, j]) => ({ diarista_id: d.id, data, hora_inicio: j.inicio, hora_fim: j.fim }))),
    avaliacoes: f.diaristas.flatMap((d) => d.avaliacoes.map((a) => ({ diarista_id: d.id, ...a }))),
    atendimentos: f.atendimentos.map(linhaDeAtendimento),
    pacotes: f.pacotes.map(linhaDePacote),
    cupons: Object.entries(f.cupons).map(([codigo, valor]) => ({ codigo, valor, ativo: true })),
    eventos: [],
  }, { diaristas: { disponibilidade: 'diarista_id', avaliacoes: 'diarista_id' } });
  return { db, casos: criarCasosDeUso(criarInfraestruturaNeon(db)) };
}

test('neon: busca e perfil leem diaristas com agenda e avaliações', async () => {
  const { casos } = montar();
  const lista = await casos.buscarProfissionais({ regiao: 'Asa Norte' });
  assert.equal(lista.find((p) => p.id === 'd1').totalAvulso, reais(235));
  const perfil = await casos.obterPerfil('d1');
  assert.equal(perfil.avaliacoes.length, 3);
  assert.ok(perfil.proximosHorarios.length > 0);
});

test('neon: reserva, aceite e conclusão gravam no banco e registram o pagamento simulado', async () => {
  const { casos, db } = montar();
  const perfil = await casos.obterPerfil('d3');
  const data = perfil.proximosHorarios[0].data;
  const a = await casos.solicitarReserva({ clienteId: 'c1', diaristaId: 'd3', data, horaInicio: 10, duracao: 'diaria', modalidade: 'avulso', metodo: 'pix', codigoCupom: 'LANCAMENTO' });
  const linha = db.dados.atendimentos.find((l) => l.id === a.id);
  assert.equal(linha.total_cliente, reais(180));
  assert.equal(linha.total_cliente, linha.servico + linha.transporte + linha.taxa_cliente - linha.cupom);
  await casos.responderPedido({ atendimentoId: a.id, diaristaId: 'd3', aceitar: true });
  await casos.confirmarChegada({ atendimentoId: a.id, codigo: a.codigoConfirmacao });
  await casos.concluirAtendimento({ atendimentoId: a.id });
  assert.equal(db.dados.atendimentos.find((l) => l.id === a.id).status, STATUS.CONCLUIDO);
  assert.deepEqual(db.dados.eventos.map((e) => e.tipo).filter((t) => t.startsWith('pagamento')), ['pagamento.autorizacao', 'pagamento.captura']);
});

test('neon: preços e agenda da diarista são regravados', async () => {
  const { casos, db } = montar();
  await casos.atualizarPrecos('d1', { diaria: reais(220), meiaDiaria: reais(120), transporte: reais(20), descontoPacote: 0.1 });
  assert.equal(db.dados.diaristas.find((d) => d.id === 'd1').diaria, reais(220));
  const painel = await casos.painelDiarista('d1');
  const livre = Object.keys(painel.diarista.disponibilidade).sort()[0];
  await casos.definirDisponibilidade('d1', livre, null);
  assert.ok(!db.dados.disponibilidade.some((x) => x.diarista_id === 'd1' && x.data === livre));
});

test('neon: candidatura aprovada vira diarista com agenda no banco', async () => {
  const { db, casos } = montar();
  db.dados.candidaturas = [];
  const c = await casos.iniciarCadastro({ nome: 'Joaquina Alves', celular: '61911112222' });
  await casos.atualizarCandidatura(c.id, {
    regioes: ['Asa Norte'], tarefas: ['Limpeza geral'], anosExperiencia: 4,
    precos: { diaria: reais(170), meiaDiaria: reais(95), transporte: reais(15), descontoPacote: 0.05 },
    agenda: { diasDaSemana: [2, 4], inicio: 8, fim: 17 },
    verificacao: { identidade: 'ok', certidao_pcdf: 'ok', certidao_pf: 'ok', referencia_1: 'ok', referencia_2: 'ok', conversa: 'ok' },
  });
  await casos.registrarAceiteDaConduta(c.id);
  const { diarista } = await casos.aprovarCandidatura(c.id);
  assert.equal(db.dados.diaristas.find((d) => d.id === diarista.id).diaria, reais(170));
  assert.ok(db.dados.disponibilidade.filter((x) => x.diarista_id === diarista.id).length >= 5);
  assert.equal(db.dados.candidaturas[0].status, 'aprovada');
  assert.equal(db.dados.candidaturas[0].diarista_id, diarista.id);
});
