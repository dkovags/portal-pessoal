// Executor de SQL sobre HTTP do Neon (o mesmo protocolo do driver serverless), só com fetch.
// Cada consulta volta como uma lista de objetos: o SQL é embrulhado em json_agg.

export class FalhaNoBanco extends Error {
  constructor(mensagem, detalhe) { super(mensagem); this.name = 'FalhaNoBanco'; this.detalhe = detalhe; }
}

const valorParametro = (v) => (v === null || v === undefined ? null
  : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** @param {{urlConexao:string, fetch?:typeof fetch}} op */
export function executorNeonHttp({ urlConexao, fetch: f = fetch }) {
  const host = new URL(urlConexao).hostname;
  const destinos = [`https://${host}/sql`, `https://api.${host.split('.').slice(1).join('.')}/sql`];
  let destino = 0;

  async function enviar(query, params) {
    for (;;) {
      const resposta = await f(destinos[destino], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Neon-Connection-String': urlConexao,
          'Neon-Raw-Text-Output': 'true',
          'Neon-Array-Mode': 'true',
        },
        body: JSON.stringify({ query, params: params.map(valorParametro) }),
      });
      if (resposta.status === 404 && destino + 1 < destinos.length) { destino++; continue; }
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new FalhaNoBanco('Falha ao acessar o banco.', corpo?.message ?? resposta.status);
      return corpo;
    }
  }

  return {
    /** @returns {Promise<any[]>} */
    async consultar(sql, params = []) {
      const r = await enviar(`select coalesce(json_agg(t), '[]'::json)::text as r from (${sql}) t`, params);
      return JSON.parse(r.rows[0][0]);
    },
    async executar(sql, params = []) { await enviar(sql, params); },
  };
}
