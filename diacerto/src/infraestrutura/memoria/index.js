import { gerarDadosFicticios } from './dados-ficticios.js';
import {
  repositorioDiaristasEmMemoria, repositorioClientesEmMemoria, repositorioAtendimentosEmMemoria,
  repositorioPacotesEmMemoria, cuponsEmMemoria, repositorioCandidaturasEmMemoria, repositorioOcorrenciasEmMemoria, repositorioPerfisEmMemoria, repositorioAvaliacoesEmMemoria,
  repositorioAceitesEmMemoria, repositorioParametrosEmMemoria, repositorioLocaisEmMemoria,
} from './repositorios.js';
import { pagamentoSimulado, notificadorSimulado, relogio as criarRelogio, geradorDeIds } from './servicos.js';

/** Monta todas as dependências em memória. @param {{agora?:Date}} [op] */
export function criarInfraestruturaEmMemoria(op = {}) {
  const relogio = criarRelogio(op.agora);
  const dados = gerarDadosFicticios(relogio.agora());
  const diaristas = repositorioDiaristasEmMemoria(dados.diaristas);
  return {
    diaristas,
    avaliacoes: repositorioAvaliacoesEmMemoria(diaristas),
    clientes: repositorioClientesEmMemoria(dados.clientes),
    atendimentos: repositorioAtendimentosEmMemoria(dados.atendimentos),
    pacotes: repositorioPacotesEmMemoria(dados.pacotes),
    aceites: repositorioAceitesEmMemoria(dados.aceites),
    locais: repositorioLocaisEmMemoria(dados.locais),
    configuracao: repositorioParametrosEmMemoria(dados.parametros, relogio),
    cupons: cuponsEmMemoria(dados.cupons),
    candidaturas: repositorioCandidaturasEmMemoria(dados.candidaturas),
    ocorrencias: repositorioOcorrenciasEmMemoria(dados.ocorrencias),
    perfis: repositorioPerfisEmMemoria(dados.perfis),
    pagamento: pagamentoSimulado(),
    notificador: notificadorSimulado(),
    relogio,
    ids: geradorDeIds('at'),
  };
}
