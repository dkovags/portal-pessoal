// Verificação do JWT do Neon Auth (EdDSA/Ed25519) só com WebCrypto, sem dependências.

const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const json = (s) => JSON.parse(new TextDecoder().decode(b64url(s)));

export class TokenInvalido extends Error { constructor(m) { super(m); this.name = 'TokenInvalido'; } }

/** @param {{jwksUrl:string, emissor?:string, fetch?:typeof fetch, agora?:()=>number}} op */
export function verificadorJwt({ jwksUrl, emissor, fetch: f = fetch, agora = () => Date.now() }) {
  let chaves = null;
  let carregadoEm = 0;
  async function chave(kid) {
    if (!chaves || agora() - carregadoEm > 10 * 60e3 || !chaves.has(kid)) {
      const r = await f(jwksUrl);
      if (!r.ok) throw new TokenInvalido('Não foi possível obter as chaves de login.');
      const { keys } = await r.json();
      chaves = new Map();
      for (const k of keys) {
        if (k.kty === 'OKP' && k.crv === 'Ed25519') {
          chaves.set(k.kid, await crypto.subtle.importKey('jwk', { kty: k.kty, crv: k.crv, x: k.x }, { name: 'Ed25519' }, false, ['verify']));
        }
      }
      carregadoEm = agora();
    }
    return chaves.get(kid);
  }

  return async function verificar(token) {
    const partes = String(token ?? '').split('.');
    if (partes.length !== 3) throw new TokenInvalido('Token malformado.');
    const [cab, corpo, assinatura] = partes;
    const cabecalho = json(cab);
    if (cabecalho.alg !== 'EdDSA') throw new TokenInvalido('Algoritmo não aceito.');
    const k = await chave(cabecalho.kid);
    if (!k) throw new TokenInvalido('Chave desconhecida.');
    const valido = await crypto.subtle.verify({ name: 'Ed25519' }, k, b64url(assinatura), new TextEncoder().encode(`${cab}.${corpo}`));
    if (!valido) throw new TokenInvalido('Assinatura inválida.');
    const p = json(corpo);
    const agoraS = agora() / 1000;
    if (typeof p.exp !== 'number' || p.exp < agoraS - 30) throw new TokenInvalido('Sessão expirada.');
    if (p.nbf && p.nbf > agoraS + 30) throw new TokenInvalido('Token ainda não válido.');
    if (emissor && p.iss && new URL(p.iss).origin !== new URL(emissor).origin) throw new TokenInvalido('Emissor não reconhecido.');
    return p;
  };
}
