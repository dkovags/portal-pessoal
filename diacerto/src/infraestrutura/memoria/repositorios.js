// Adaptadores em memória das portas da aplicação. Servem ao protótipo e aos testes;
// serão substituídos por adaptadores de banco (Neon/Postgres) sem mudar as camadas acima.

const clonar = (v) => structuredClone(v);

/** @param {any[]} iniciais @returns {import('../../aplicacao/portas.js').RepositorioDiaristas} */
export function repositorioDiaristasEmMemoria(iniciais) {
  const dados = new Map(iniciais.map((d) => [d.id, clonar(d)]));
  return {
    async listar(filtro = {}) {
      return [...dados.values()]
        .filter((d) => !filtro.regiao || d.regioes.some((r) => r.toLowerCase() === filtro.regiao.toLowerCase()))
        .map(clonar);
    },
    async obter(id) { return dados.has(id) ? clonar(dados.get(id)) : null; },
    async salvar(d) { dados.set(d.id, clonar(d)); },
    async criar(d) { if (dados.has(d.id)) throw new Error('Diarista já existe.'); dados.set(d.id, clonar(d)); },
  };
}

/** @returns {import('../../aplicacao/portas.js').RepositorioCandidaturas} */
export function repositorioCandidaturasEmMemoria(iniciais = []) {
  const dados = new Map(iniciais.map((c) => [c.id, clonar(c)]));
  return {
    async listar() { return [...dados.values()].map(clonar); },
    async obter(id) { return dados.has(id) ? clonar(dados.get(id)) : null; },
    async salvar(c) { dados.set(c.id, clonar({ ...dados.get(c.id), ...c })); },
  };
}

/** @returns {import('../../aplicacao/portas.js').RepositorioClientes} */
export function repositorioClientesEmMemoria(iniciais) {
  const dados = new Map(iniciais.map((c) => [c.id, clonar(c)]));
  return {
    async obter(id) { return dados.has(id) ? clonar(dados.get(id)) : null; },
    async listar() { return [...dados.values()].map(clonar); },
    async criar(c) { dados.set(c.id, clonar(c)); },
  };
}

/** @returns {import('../../aplicacao/portas.js').RepositorioPerfis} */
export function repositorioPerfisEmMemoria(iniciais = []) {
  const dados = new Map(iniciais.map((p) => [p.email, clonar(p)]));
  return {
    async porEmail(email) { const p = dados.get(String(email).toLowerCase()); return p ? clonar(p) : null; },
    async listar() { return [...dados.values()].map(clonar); },
    async salvar(p) { dados.set(p.email, clonar(p)); },
    async remover(email) { dados.delete(email); },
  };
}

/** @returns {import('../../aplicacao/portas.js').RepositorioAtendimentos} */
export function repositorioAtendimentosEmMemoria(iniciais = []) {
  const dados = new Map(iniciais.map((a) => [a.id, clonar(a)]));
  const todos = () => [...dados.values()].map(clonar);
  return {
    async salvar(a) { dados.set(a.id, clonar(a)); },
    async obter(id) { return dados.has(id) ? clonar(dados.get(id)) : null; },
    async listarPorCliente(id) { return todos().filter((a) => a.clienteId === id); },
    async listarPorDiarista(id) { return todos().filter((a) => a.diaristaId === id); },
    async listarTodos() { return todos(); },
  };
}

/** @returns {import('../../aplicacao/portas.js').RepositorioPacotes} */
export function repositorioPacotesEmMemoria(iniciais = []) {
  const dados = new Map(iniciais.map((p) => [p.id, clonar(p)]));
  return {
    async obter(id) { return dados.has(id) ? clonar(dados.get(id)) : null; },
    async listarPorCliente(clienteId) { return [...dados.values()].filter((p) => p.clienteId === clienteId).map(clonar); },
    async salvar(p) { dados.set(p.id, clonar(p)); },
  };
}

/** @returns {import('../../aplicacao/portas.js').RepositorioAceites} */
export function repositorioAceitesEmMemoria(iniciais = []) {
  const dados = iniciais.map(clonar);
  return {
    async listar(email) { return dados.filter((a) => a.email === String(email).toLowerCase()).map(({ email: _, ...a }) => clonar(a)); },
    async registrar(a) {
      if (!dados.some((x) => x.email === a.email && x.documento === a.documento && x.versao === a.versao)) dados.push(clonar(a));
    },
  };
}

/** Versões dos parâmetros comerciais; a mais recente já em vigor é a vigente. @returns {import('../../aplicacao/portas.js').RepositorioParametros} */
export function repositorioParametrosEmMemoria(iniciais = [], relogio) {
  const versoes = iniciais.map(clonar);
  const ordenadas = () => versoes.map((v, i) => ({ ...clonar(v), id: i + 1 }))
    .sort((a, b) => new Date(b.vigenteDesde) - new Date(a.vigenteDesde) || b.id - a.id);
  return {
    async vigente() { return ordenadas().find((v) => new Date(v.vigenteDesde) <= relogio.agora()) ?? null; },
    async historico() { return ordenadas(); },
    async salvar(v) { versoes.push(clonar(v)); },
  };
}

/** @returns {import('../../aplicacao/portas.js').ServicoCupons} */
export function cuponsEmMemoria(tabela) {
  return { async valor(codigo) { return tabela[String(codigo).trim().toUpperCase()] ?? null; } };
}

/** @returns {import('../../aplicacao/portas.js').RepositorioOcorrencias} */
export function repositorioOcorrenciasEmMemoria(iniciais = []) {
  const dados = new Map(iniciais.map((o) => [o.id, clonar(o)]));
  return {
    async listar() { return [...dados.values()].map(clonar); },
    async salvar(o) { dados.set(o.id, clonar(o)); },
  };
}

/** @returns {import('../../aplicacao/portas.js').RepositorioAvaliacoes} */
export function repositorioAvaliacoesEmMemoria(diaristas) {
  const porAtendimento = new Map();
  return {
    async doAtendimento(id) { const r = porAtendimento.get(id) ?? {}; return { doCliente: r.cliente ? clonar(r.cliente) : null, daDiarista: r.diarista ? clonar(r.diarista) : null }; },
    async salvar(av, ctx) {
      porAtendimento.set(av.atendimentoId, { ...(porAtendimento.get(av.atendimentoId) ?? {}), [av.lado]: clonar(av) });
      if (ctx.publica) {
        const d = await diaristas.obter(ctx.diaristaId);
        await diaristas.salvar({ ...d, avaliacoes: [ctx.publica, ...d.avaliacoes] });
      }
    },
  };
}
