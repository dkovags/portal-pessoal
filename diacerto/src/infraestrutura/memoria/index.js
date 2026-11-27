import { gerarDadosFicticios } from './dados-ficticios.js';
import {
  repositorioDiaristasEmMemoria, repositorioClientesEmMemoria, repositorioAtendimentosEmMemoria,
  repositorioPacotesEmMemoria, cuponsEmMemoria, repositorioCandidaturasEmMemoria, repositorioOcorrenciasEmMemoria,
} from './repositorios.js';
import { pagamentoSimulado, notificadorSimulado, relogio as criarRelogio, geradorDeIds } from './servicos.js';

/** Monta todas as dependências em memória. @param {{agora?:Date}} [op] */
export function criarInfraestruturaEmMemoria(op = {}) {
  const relogio = criarRelogio(op.agora);
  const dados = gerarDadosFicticios(relogio.agora());
  return {
    diaristas: repositorioDiaristasEmMemoria(dados.diaristas),
    clientes: repositorioClientesEmMemoria(dados.clientes),
    atendimentos: repositorioAtendimentosEmMemoria(dados.atendimentos),
    pacotes: repositorioPacotesEmMemoria(dados.pacotes, relogio),
    cupons: cuponsEmMemoria(dados.cupons),
    candidaturas: repositorioCandidaturasEmMemoria(dados.candidaturas),
    ocorrencias: repositorioOcorrenciasEmMemoria(dados.ocorrencias),
    pagamento: pagamentoSimulado(),
    notificador: notificadorSimulado(),
    relogio,
    ids: geradorDeIds('at'),
  };
}
