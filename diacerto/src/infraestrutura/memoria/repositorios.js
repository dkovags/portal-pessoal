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
  return { async obter(id) { return dados.has(id) ? clonar(dados.get(id)) : null; } };
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
  };
}

/** @returns {import('../../aplicacao/portas.js').RepositorioPacotes} */
export function repositorioPacotesEmMemoria(iniciais = [], relogio) {
  const dados = new Map(iniciais.map((p) => [p.id, clonar(p)]));
  return {
    async obterAtivo(clienteId, diaristaId) {
      const agora = relogio.agora();
      const p = [...dados.values()].find((x) => x.clienteId === clienteId && x.diaristaId === diaristaId
        && x.usados < x.total && x.validade > agora);
      return p ? clonar(p) : null;
    },
    async salvar(p) { dados.set(p.id, clonar(p)); },
  };
}

/** @returns {import('../../aplicacao/portas.js').ServicoCupons} */
export function cuponsEmMemoria(tabela) {
  return { async valor(codigo) { return tabela[String(codigo).trim().toUpperCase()] ?? null; } };
}
