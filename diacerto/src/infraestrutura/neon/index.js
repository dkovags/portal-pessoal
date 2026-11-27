// Infraestrutura sobre o Neon: login Google (Neon Auth) e Data API no schema diacerto.
import {
  repositorioDiaristasNeon, repositorioClientesNeon, repositorioAtendimentosNeon,
  repositorioPacotesNeon, cuponsNeon, pagamentoRegistrado, notificadorRegistrado, repositorioCandidaturasNeon, repositorioOcorrenciasNeon,
} from './repositorios.js';

export const CONFIG_NEON = Object.freeze({
  banco: 'https://ep-little-poetry-b6g84hgd.c-2.sa-east-1.aws.neon.tech/neondb', // projeto Neon "diztudo"
  schema: 'diacerto',
});

const relogio = { agora: () => new Date() };
const ids = {
  novo: () => crypto.randomUUID(),
  codigo: () => String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000)),
};

/** Monta as dependências a partir de um construtor de consultas já no schema diacerto. */
export function criarInfraestruturaNeon(db) {
  return {
    diaristas: repositorioDiaristasNeon(db, relogio),
    clientes: repositorioClientesNeon(db),
    atendimentos: repositorioAtendimentosNeon(db),
    pacotes: repositorioPacotesNeon(db, relogio),
    cupons: cuponsNeon(db),
    candidaturas: repositorioCandidaturasNeon(db),
    ocorrencias: repositorioOcorrenciasNeon(db),
    pagamento: pagamentoRegistrado(db),
    notificador: notificadorRegistrado(db),
    relogio,
    ids,
  };
}

/** Carrega o SDK do Neon e devolve funções de sessão e o acesso ao schema. */
export async function conectarNeon(config = CONFIG_NEON) {
  let mod;
  try { mod = await import('https://esm.sh/@neon/neon-js@0.10.2'); } catch { mod = await import('https://esm.sh/@neondatabase/neon-js'); }
  const cliente = mod.createClient(config.banco);
  if (typeof cliente.schema !== 'function') throw new Error('O SDK do Neon não permite escolher o schema.');
  const aqui = location.origin + location.pathname;
  return {
    async sessao() {
      try { const r = await cliente.auth.getSession(); return r?.data?.session ? r.data : null; } catch { return null; }
    },
    async entrar() {
      const r = await cliente.auth.signIn.social({ provider: 'google', callbackURL: aqui });
      if (r?.error) throw r.error;
    },
    async sair() { await cliente.auth.signOut(); },
    db: cliente.schema(config.schema),
  };
}
