// API HTTP do DiaCerto: expõe os casos de uso da aplicação com login e permissões.
// Rotas: GET /saude · GET /eu · POST /casos/<nome> com { "args": [...] }.
import { RegraDeNegocioViolada } from '../../dominio/index.js';
import { autorizar, SemPermissao } from './permissoes.js';
import { TokenInvalido } from './jwt.js';

const LIMITE_CORPO = 64 * 1024;

/**
 * @param {{casos:Record<string,Function>, dep:any, verificarToken:(t:string)=>Promise<any>, origens:string[], registrar?:(e:any)=>void, verificarBanco?:()=>Promise<any>}} op
 */
export function criarServidor({ casos, dep, verificarToken, origens, registrar = console.error, verificarBanco = null }) {
  const cors = (origem) => ({
    'Access-Control-Allow-Origin': origens.includes(origem) ? origem : origens[0],
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  });
  const responder = (origem, status, corpo) => new Response(JSON.stringify(corpo), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(origem) },
  });

  async function quemE(request) {
    const auth = request.headers.get('authorization') ?? '';
    if (!auth.toLowerCase().startsWith('bearer ')) return null;
    const payload = await verificarToken(auth.slice(7).trim());
    const email = String(payload.email ?? (await dep.perfis.emailDoUsuario(payload.sub)) ?? '').toLowerCase();
    if (!email) throw new TokenInvalido('Conta sem e-mail.');
    return { email, perfil: await dep.perfis.porEmail(email) };
  }

  return {
    async fetch(request) {
      const origem = request.headers.get('origin') ?? '';
      if (origem && !origens.includes(origem)) return responder(origem, 403, { erro: { codigo: 'ORIGEM', mensagem: 'Origem não autorizada.' } });
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origem) });
      const caminho = new URL(request.url).pathname.replace(/\/+$/, '');
      try {
        if (request.method === 'GET' && caminho.endsWith('/saude')) {
          let banco = 'nao_verificado';
          if (verificarBanco) { try { await verificarBanco(); banco = 'ok'; } catch (e) { registrar(e); banco = 'falha'; } }
          return responder(origem, banco === 'falha' ? 503 : 200, { ok: banco !== 'falha', banco });
        }
        if (request.method === 'GET' && caminho.endsWith('/eu')) {
          const u = await quemE(request);
          if (!u) return responder(origem, 401, { erro: { codigo: 'LOGIN', mensagem: 'Entre com a sua conta.' } });
          const aceitesPendentes = u.perfil && casos.aceitesPendentes ? await casos.aceitesPendentes({ email: u.email, papel: u.perfil.papel }) : [];
          return responder(origem, 200, { resultado: { email: u.email, ...(u.perfil ?? { papel: null }), aceitesPendentes } });
        }
        const m = caminho.match(/\/casos\/([A-Za-z]+)$/);
        if (request.method !== 'POST' || !m) return responder(origem, 404, { erro: { codigo: 'ROTA', mensagem: 'Rota não encontrada.' } });
        const nome = m[1];
        if (!Object.hasOwn(casos, nome) || typeof casos[nome] !== 'function') return responder(origem, 404, { erro: { codigo: 'CASO', mensagem: 'Operação desconhecida.' } });
        const texto = await request.text();
        if (texto.length > LIMITE_CORPO) return responder(origem, 413, { erro: { codigo: 'TAMANHO', mensagem: 'Pedido grande demais.' } });
        const { args = [] } = texto ? JSON.parse(texto) : {};
        const u = await quemE(request);
        const permitidos = await autorizar(nome, args, u?.perfil ?? null, dep, u?.email ?? null);
        const resultado = await casos[nome](...permitidos);
        return responder(origem, 200, { resultado: resultado ?? null });
      } catch (falha) {
        if (falha instanceof RegraDeNegocioViolada) return responder(origem, 422, { erro: { codigo: falha.codigo, mensagem: falha.message } });
        if (falha instanceof SemPermissao) return responder(origem, 403, { erro: { codigo: 'PERMISSAO', mensagem: falha.message } });
        if (falha instanceof TokenInvalido) return responder(origem, 401, { erro: { codigo: 'LOGIN', mensagem: 'Sua sessão expirou. Entre de novo.' } });
        if (falha instanceof SyntaxError) return responder(origem, 400, { erro: { codigo: 'JSON', mensagem: 'Pedido inválido.' } });
        registrar(falha);
        return responder(origem, 500, { erro: { codigo: 'INTERNO', mensagem: 'Erro interno. Tente de novo em instantes.' } });
      }
    },
  };
}
