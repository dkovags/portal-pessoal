import { criarRepositoriosPostgres, servicosRegistrados } from './repositorios.js';

export { executorNeonHttp, FalhaNoBanco } from './sql-http.js';

/** Monta todas as dependências dos casos de uso sobre um executor de SQL. */
export function criarInfraestruturaPostgres(db, relogio = { agora: () => new Date() }) {
  const repos = criarRepositoriosPostgres(db, relogio);
  const { pagamento, notificador } = servicosRegistrados(db);
  return {
    ...repos, pagamento, notificador, relogio,
    ids: {
      novo: () => crypto.randomUUID(),
      codigo: () => String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000)),
    },
  };
}
