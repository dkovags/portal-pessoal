// Adaptadores das portas sobre Postgres (schema diacerto), para rodar no servidor.
// `db` = { consultar(sql, params) -> linhas, executar(sql, params) }.
import {
  diaristaDeLinha, linhaDeDiarista, atendimentoDeLinha, linhaDeAtendimento, pacoteDeLinha, linhaDePacote,
  candidaturaDeLinha, linhaDeCandidatura, ocorrenciaDeLinha, linhaDeOcorrencia, chaveDia,
} from '../mapeamento-sql.js';

const TABELAS = new Set(['diaristas', 'atendimentos', 'pacotes', 'candidaturas', 'ocorrencias', 'disponibilidade', 'eventos', 'clientes', 'perfis']);
const coluna = (c) => { if (!/^[a-z_]+$/.test(c)) throw new Error(`coluna inválida: ${c}`); return c; };

function gravar(db, tabela, linha, chave = 'id') {
  if (!TABELAS.has(tabela)) throw new Error(`tabela inválida: ${tabela}`);
  const cols = Object.keys(linha).map(coluna);
  const atualiza = cols.filter((c) => c !== chave).map((c) => `${c} = excluded.${c}`).join(', ');
  return db.executar(
    `insert into diacerto.${tabela} (${cols.join(', ')}) select ${cols.join(', ')} from json_populate_record(null::diacerto.${tabela}, $1::json)
     on conflict (${coluna(chave)}) do ${atualiza ? `update set ${atualiza}` : 'nothing'}`, [linha]);
}

function inserirVarias(db, tabela, linhas) {
  if (!linhas.length) return Promise.resolve();
  const cols = Object.keys(linhas[0]).map(coluna);
  return db.executar(`insert into diacerto.${tabela} (${cols.join(', ')}) select ${cols.join(', ')} from json_populate_recordset(null::diacerto.${tabela}, $1::json)`, [linhas]);
}

async function completarDiaristas(db, linhas) {
  if (!linhas.length) return [];
  const ids = linhas.map((l) => l.id);
  const disp = await db.consultar('select * from diacerto.disponibilidade where diarista_id in (select json_array_elements_text($1::json))', [ids]);
  const aval = await db.consultar('select diarista_id, nota, texto, autor, mes from diacerto.avaliacoes where diarista_id in (select json_array_elements_text($1::json)) order by id', [ids]);
  return linhas.map((l) => diaristaDeLinha({ ...l, disponibilidade: disp.filter((x) => x.diarista_id === l.id), avaliacoes: aval.filter((x) => x.diarista_id === l.id) }));
}

const disponibilidadeEmLinhas = (d, aPartirDe) => Object.entries(d.disponibilidade)
  .filter(([data]) => !aPartirDe || data >= aPartirDe)
  .map(([data, j]) => ({ diarista_id: d.id, data, hora_inicio: j.inicio, hora_fim: j.fim }));

export function criarRepositoriosPostgres(db, relogio) {
  return {
    diaristas: {
      async listar(filtro = {}) {
        const linhas = await db.consultar('select * from diacerto.diaristas where $1::text is null or $1 = any(regioes) order by id', [filtro.regiao ?? null]);
        return completarDiaristas(db, linhas);
      },
      async obter(id) {
        const [d] = await completarDiaristas(db, await db.consultar('select * from diacerto.diaristas where id = $1', [id]));
        return d ?? null;
      },
      async salvar(d) {
        await gravar(db, 'diaristas', linhaDeDiarista(d));
        const hoje = chaveDia(relogio.agora());
        await db.executar('delete from diacerto.disponibilidade where diarista_id = $1 and data >= $2::date', [d.id, hoje]);
        await inserirVarias(db, 'disponibilidade', disponibilidadeEmLinhas(d, hoje));
      },
      async criar(d) {
        await db.executar(`insert into diacerto.diaristas select * from json_populate_record(null::diacerto.diaristas, $1::json)`, [linhaDeDiarista(d)]);
        await inserirVarias(db, 'disponibilidade', disponibilidadeEmLinhas(d));
      },
    },
    clientes: {
      async obter(id) {
        const [c] = await db.consultar('select id, nome, endereco, regiao from diacerto.clientes where id = $1', [id]);
        return c ?? null;
      },
      async listar() { return db.consultar('select id, nome, endereco, regiao from diacerto.clientes order by nome'); },
      async criar(c) { await gravar(db, 'clientes', { id: c.id, nome: c.nome, endereco: c.endereco, regiao: c.regiao }); },
    },
    atendimentos: {
      async salvar(a) { await gravar(db, 'atendimentos', linhaDeAtendimento(a)); },
      async obter(id) { const [l] = await db.consultar('select * from diacerto.atendimentos where id = $1', [id]); return l ? atendimentoDeLinha(l) : null; },
      async listarPorCliente(id) { return (await db.consultar('select * from diacerto.atendimentos where cliente_id = $1', [id])).map(atendimentoDeLinha); },
      async listarPorDiarista(id) { return (await db.consultar('select * from diacerto.atendimentos where diarista_id = $1', [id])).map(atendimentoDeLinha); },
      async listarTodos() { return (await db.consultar('select * from diacerto.atendimentos')).map(atendimentoDeLinha); },
    },
    pacotes: {
      async obterAtivo(clienteId, diaristaId) {
        const [l] = await db.consultar(`select * from diacerto.pacotes where cliente_id = $1 and diarista_id = $2
          and usados < total and validade > $3::timestamptz order by validade limit 1`, [clienteId, diaristaId, relogio.agora().toISOString()]);
        return l ? pacoteDeLinha(l) : null;
      },
      async salvar(p) { await gravar(db, 'pacotes', linhaDePacote(p)); },
    },
    cupons: {
      async valor(codigo) {
        const [l] = await db.consultar('select valor from diacerto.cupons where codigo = upper(trim($1)) and ativo', [String(codigo)]);
        return l ? l.valor : null;
      },
    },
    candidaturas: {
      async listar() { return (await db.consultar('select * from diacerto.candidaturas')).map(candidaturaDeLinha); },
      async obter(id) { const [l] = await db.consultar('select * from diacerto.candidaturas where id = $1', [id]); return l ? candidaturaDeLinha(l) : null; },
      async salvar(c) {
        const atual = await db.consultar('select criada_em from diacerto.candidaturas where id = $1', [c.id]);
        const linha = linhaDeCandidatura(c);
        if (atual.length) delete linha.criada_em;
        await gravar(db, 'candidaturas', linha);
      },
    },
    ocorrencias: {
      async listar() { return (await db.consultar('select * from diacerto.ocorrencias')).map(ocorrenciaDeLinha); },
      async salvar(o) { await gravar(db, 'ocorrencias', linhaDeOcorrencia(o)); },
    },
    perfis: {
      async porEmail(email) {
        const [p] = await db.consultar('select email, papel, cliente_id, diarista_id from diacerto.perfis where email = lower($1)', [email]);
        return p ? { email: p.email, papel: p.papel, clienteId: p.cliente_id, diaristaId: p.diarista_id } : null;
      },
      async listar() {
        return (await db.consultar('select email, papel, cliente_id, diarista_id from diacerto.perfis'))
          .map((p) => ({ email: p.email, papel: p.papel, clienteId: p.cliente_id, diaristaId: p.diarista_id }));
      },
      async salvar(p) { await gravar(db, 'perfis', { email: p.email, papel: p.papel, cliente_id: p.clienteId, diarista_id: p.diaristaId }, 'email'); },
      async remover(email) { await db.executar('delete from diacerto.perfis where email = $1', [email]); },
      async emailDoUsuario(id) {
        const [u] = await db.consultar('select email from neon_auth."user" where id::text = $1 and coalesce(banned, false) = false', [id]);
        return u?.email ?? null;
      },
    },
  };
}

/** Pagamento e avisos ainda simulados, registrados na tabela de eventos. */
export function servicosRegistrados(db) {
  const registrar = (tipo, dados) => db.executar('insert into diacerto.eventos (tipo, dados) values ($1, $2::jsonb)', [tipo, dados]);
  return {
    pagamento: {
      async autorizar(p) { const autorizacao = `sim-${crypto.randomUUID()}`; await registrar('pagamento.autorizacao', { ...p, autorizacao }); return { autorizacao }; },
      async capturarComSplit(p) { await registrar('pagamento.captura', p); },
      async estornar(p) { await registrar('pagamento.estorno', p); },
    },
    notificador: { async enviar(m) { await registrar('notificacao', m); } },
  };
}
