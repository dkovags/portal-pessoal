// Adaptadores das portas sobre a Data API do Neon (estilo PostgREST).
// `db` é o construtor de consultas já apontado para o schema diacerto.
import {
  diaristaDeLinha, linhaDeDiarista, atendimentoDeLinha, linhaDeAtendimento,
  pacoteDeLinha, linhaDePacote, chaveDia, candidaturaDeLinha, linhaDeCandidatura, ocorrenciaDeLinha, linhaDeOcorrencia,
} from './mapeamento.js';

export class FalhaNoBanco extends Error {
  constructor(operacao, erro) {
    super(`Não foi possível ${operacao}. ${erro?.message ?? ''}`.trim());
    this.name = 'FalhaNoBanco';
    this.causa = erro;
  }
}

async function exec(operacao, consulta) {
  const { data, error } = await consulta;
  if (error) throw new FalhaNoBanco(operacao, error);
  return data;
}

const DIARISTA_COMPLETA = '*, disponibilidade(*), avaliacoes(*)';

/** @returns {import('../../aplicacao/portas.js').RepositorioDiaristas} */
export function repositorioDiaristasNeon(db, relogio) {
  return {
    async listar(filtro = {}) {
      let q = db.from('diaristas').select(DIARISTA_COMPLETA).order('id');
      if (filtro.regiao) q = q.contains('regioes', [filtro.regiao]);
      return (await exec('carregar as profissionais', q)).map(diaristaDeLinha);
    },
    async obter(id) {
      const linha = await exec('carregar a profissional', db.from('diaristas').select(DIARISTA_COMPLETA).eq('id', id).maybeSingle());
      return linha ? diaristaDeLinha(linha) : null;
    },
    async criar(d) {
      await exec('criar o perfil da profissional', db.from('diaristas').insert(linhaDeDiarista(d)));
      const linhas = Object.entries(d.disponibilidade).map(([data, j]) => ({ diarista_id: d.id, data, hora_inicio: j.inicio, hora_fim: j.fim }));
      if (linhas.length) await exec('gravar a agenda inicial', db.from('disponibilidade').insert(linhas));
    },
    async salvar(d) {
      await exec('salvar os dados da profissional', db.from('diaristas').update(linhaDeDiarista(d)).eq('id', d.id));
      // a agenda a partir de hoje é regravada; o passado fica como está
      const hoje = chaveDia(relogio.agora());
      await exec('atualizar a agenda', db.from('disponibilidade').delete().eq('diarista_id', d.id).gte('data', hoje));
      const linhas = Object.entries(d.disponibilidade).filter(([data]) => data >= hoje)
        .map(([data, j]) => ({ diarista_id: d.id, data, hora_inicio: j.inicio, hora_fim: j.fim }));
      if (linhas.length) await exec('atualizar a agenda', db.from('disponibilidade').insert(linhas));
    },
  };
}

/** @returns {import('../../aplicacao/portas.js').RepositorioClientes} */
export function repositorioClientesNeon(db) {
  return {
    async obter(id) {
      const l = await exec('carregar o cliente', db.from('clientes').select('*').eq('id', id).maybeSingle());
      return l ? { id: l.id, nome: l.nome, endereco: l.endereco, regiao: l.regiao } : null;
    },
  };
}

/** @returns {import('../../aplicacao/portas.js').RepositorioAtendimentos} */
export function repositorioAtendimentosNeon(db) {
  return {
    async salvar(a) { await exec('salvar o atendimento', db.from('atendimentos').upsert(linhaDeAtendimento(a), { onConflict: 'id' })); },
    async obter(id) {
      const l = await exec('carregar o atendimento', db.from('atendimentos').select('*').eq('id', id).maybeSingle());
      return l ? atendimentoDeLinha(l) : null;
    },
    async listarPorCliente(id) { return (await exec('carregar os atendimentos', db.from('atendimentos').select('*').eq('cliente_id', id))).map(atendimentoDeLinha); },
    async listarPorDiarista(id) { return (await exec('carregar os atendimentos', db.from('atendimentos').select('*').eq('diarista_id', id))).map(atendimentoDeLinha); },
    async listarTodos() { return (await exec('carregar os atendimentos', db.from('atendimentos').select('*'))).map(atendimentoDeLinha); },
  };
}

/** @returns {import('../../aplicacao/portas.js').RepositorioPacotes} */
export function repositorioPacotesNeon(db, relogio) {
  return {
    async obterAtivo(clienteId, diaristaId) {
      const linhas = await exec('carregar os pacotes', db.from('pacotes').select('*')
        .eq('cliente_id', clienteId).eq('diarista_id', diaristaId).gte('validade', relogio.agora().toISOString()));
      const ativo = linhas.map(pacoteDeLinha).find((p) => p.usados < p.total);
      return ativo ?? null;
    },
    async salvar(p) { await exec('salvar o pacote', db.from('pacotes').upsert(linhaDePacote(p), { onConflict: 'id' })); },
  };
}

/** @returns {import('../../aplicacao/portas.js').ServicoCupons} */
export function cuponsNeon(db) {
  return {
    async valor(codigo) {
      const l = await exec('consultar o cupom', db.from('cupons').select('valor').eq('codigo', String(codigo).trim().toUpperCase()).eq('ativo', true).maybeSingle());
      return l ? l.valor : null;
    },
  };
}

/** Pagamento e notificações ainda simulados, mas registrados na tabela de eventos. */
export function pagamentoRegistrado(db) {
  const registrar = (tipo, dados) => exec('registrar o pagamento simulado', db.from('eventos').insert({ tipo, dados }));
  return {
    async autorizar(p) { const autorizacao = `sim-${crypto.randomUUID()}`; await registrar('pagamento.autorizacao', { ...p, autorizacao }); return { autorizacao }; },
    async capturarComSplit(p) { await registrar('pagamento.captura', p); },
    async estornar(p) { await registrar('pagamento.estorno', p); },
  };
}

export function notificadorRegistrado(db) {
  return { async enviar(m) { await exec('registrar a notificação', db.from('eventos').insert({ tipo: 'notificacao', dados: m })); } };
}

/** @returns {import('../../aplicacao/portas.js').RepositorioCandidaturas} */
export function repositorioCandidaturasNeon(db) {
  return {
    async listar() { return (await exec('carregar as candidaturas', db.from('candidaturas').select('*'))).map(candidaturaDeLinha); },
    async obter(id) {
      const l = await exec('carregar a candidatura', db.from('candidaturas').select('*').eq('id', id).maybeSingle());
      return l ? candidaturaDeLinha(l) : null;
    },
    async salvar(c) { await exec('salvar a candidatura', db.from('candidaturas').upsert(linhaDeCandidatura(c), { onConflict: 'id' })); },
  };
}

/** @returns {import('../../aplicacao/portas.js').RepositorioOcorrencias} */
export function repositorioOcorrenciasNeon(db) {
  return {
    async listar() { return (await exec('carregar as ocorrências', db.from('ocorrencias').select('*'))).map(ocorrenciaDeLinha); },
    async salvar(o) { await exec('salvar a ocorrência', db.from('ocorrencias').upsert(linhaDeOcorrencia(o), { onConflict: 'id' })); },
  };
}
