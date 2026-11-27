// Imitação mínima da Data API (estilo PostgREST) para testar os adaptadores Neon sem rede.
export function bancoFalso(tabelas, relacoes = {}) {
  const dados = structuredClone(tabelas);
  return {
    dados,
    from(tabela) { return new Consulta(dados, tabela, relacoes); },
  };
}

class Consulta {
  constructor(dados, tabela, relacoes) {
    Object.assign(this, { dados, tabela, relacoes, filtros: [], acao: 'select', colunas: '*', unico: false, ordem: null });
  }
  select(colunas = '*') { if (this.acao === 'select') this.colunas = colunas; return this; }
  insert(linhas) { this.acao = 'insert'; this.carga = [].concat(linhas); return this; }
  upsert(linhas, op = {}) { this.acao = 'upsert'; this.carga = [].concat(linhas); this.chave = op.onConflict ?? 'id'; return this; }
  update(valores) { this.acao = 'update'; this.carga = valores; return this; }
  delete() { this.acao = 'delete'; return this; }
  eq(c, v) { this.filtros.push((l) => l[c] === v); return this; }
  gte(c, v) { this.filtros.push((l) => l[c] >= v); return this; }
  contains(c, arr) { this.filtros.push((l) => arr.every((x) => (l[c] ?? []).includes(x))); return this; }
  order(c) { this.ordem = c; return this; }
  maybeSingle() { this.unico = true; return this; }
  then(ok, falha) { return Promise.resolve().then(() => this.executar()).then(ok, falha); }

  executar() {
    const t = (this.dados[this.tabela] ??= []);
    const passa = (l) => this.filtros.every((f) => f(l));
    switch (this.acao) {
      case 'insert': t.push(...structuredClone(this.carga)); return { data: null, error: null };
      case 'upsert':
        for (const nova of this.carga) {
          const i = t.findIndex((l) => l[this.chave] === nova[this.chave]);
          if (i >= 0) t[i] = { ...t[i], ...structuredClone(nova) }; else t.push(structuredClone(nova));
        }
        return { data: null, error: null };
      case 'update': t.forEach((l, i) => { if (passa(l)) t[i] = { ...l, ...structuredClone(this.carga) }; }); return { data: null, error: null };
      case 'delete': this.dados[this.tabela] = t.filter((l) => !passa(l)); return { data: null, error: null };
      default: {
        let linhas = structuredClone(t.filter(passa));
        if (this.ordem) linhas.sort((a, b) => String(a[this.ordem]).localeCompare(String(b[this.ordem])));
        for (const [rel, chave] of Object.entries(this.relacoes[this.tabela] ?? {})) {
          if (this.colunas.includes(`${rel}(`)) linhas = linhas.map((l) => ({ ...l, [rel]: structuredClone((this.dados[rel] ?? []).filter((x) => x[chave] === l.id)) }));
        }
        return { data: this.unico ? (linhas[0] ?? null) : linhas, error: null };
      }
    }
  }
}
