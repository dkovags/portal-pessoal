// Raiz de composição do servidor (Neon Functions): ambiente, banco, login e casos de uso.
import { criarCasosDeUso } from '../../aplicacao/casos-de-uso.js';
import { criarInfraestruturaPostgres, executorNeonHttp } from '../../infraestrutura/postgres/index.js';
import { verificadorJwt } from './jwt.js';
import { criarServidor } from './servidor.js';

export function criarHandler(ambiente = process.env) {
  process.env.TZ = ambiente.TZ || 'America/Sao_Paulo'; // datas dos atendimentos no horário de Brasília
  const db = executorNeonHttp({ urlConexao: ambiente.DATABASE_URL });
  const dep = criarInfraestruturaPostgres(db);
  return criarServidor({
    casos: criarCasosDeUso(dep),
    dep,
    verificarToken: verificadorJwt({ jwksUrl: ambiente.NEON_AUTH_JWKS_URL, emissor: ambiente.NEON_AUTH_BASE_URL }),
    verificarBanco: () => db.consultar('select 1 as ok'),
    origens: String(ambiente.ORIGENS || 'https://pessoal.kovags.com').split(',').map((s) => s.trim()),
  });
}
