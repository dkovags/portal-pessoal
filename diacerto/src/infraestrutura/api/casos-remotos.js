// Os casos de uso chamados pela API do servidor: o navegador não acessa o banco
// nem roda as regras de cobrança; só pede e mostra.

const CAMPOS_DATA = new Set(['inicio', 'concluidoEm', 'abertaEm', 'resolvidaEm', 'criadaEm', 'validade', 'ultima']);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const reviver = (k, v) => (CAMPOS_DATA.has(k) && typeof v === 'string' && ISO.test(v) ? new Date(v) : v);

export class FalhaNaApi extends Error {
  constructor(mensagem, codigo, status) { super(mensagem); this.name = 'FalhaNaApi'; this.codigo = codigo; this.status = status; }
}

/** @param {{url:string, token:()=>Promise<string|null>, fetch?:typeof fetch}} op */
export function clienteApi({ url, token, fetch: f = (...a) => fetch(...a) }) {
  const base = url.replace(/\/+$/, '');
  async function pedir(caminho, opcoes = {}) {
    const t = await token();
    let resposta;
    try {
      resposta = await f(base + caminho, {
        ...opcoes, headers: { ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      });
    } catch {
      throw new FalhaNaApi('Sem conexão com o servidor. Verifique a internet e tente de novo.', 'REDE', 0);
    }
    const corpo = JSON.parse(await resposta.text() || '{}', reviver);
    if (!resposta.ok) throw new FalhaNaApi(corpo.erro?.mensagem ?? 'Falha no servidor.', corpo.erro?.codigo, resposta.status);
    return corpo.resultado;
  }
  const casos = new Proxy({}, {
    get(_, nome) {
      if (typeof nome !== 'string' || nome === 'then') return undefined;
      return (...args) => pedir(`/casos/${nome}`, { method: 'POST', body: JSON.stringify({ args }) });
    },
  });
  return { casos, eu: () => pedir('/eu'), saude: () => pedir('/saude') };
}
