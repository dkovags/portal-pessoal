import { novaAvaliacao, avaliacaoPublica, RegraDeNegocioViolada, STATUS, PRAZO_AVALIACAO_DIAS } from '../dominio/index.js';

/**
 * Casos de uso de avaliação depois do atendimento.
 * @param {{avaliacoes:import('./portas.js').RepositorioAvaliacoes, atendimentos:import('./portas.js').RepositorioAtendimentos,
 *   clientes:import('./portas.js').RepositorioClientes, diaristas:import('./portas.js').RepositorioDiaristas,
 *   relogio:import('./portas.js').Relogio}} dep
 */
export function criarCasosDeAvaliacao(dep) {
  async function avaliar(lado, { atendimentoId, nota, comentario }, dono) {
    const a = await dep.atendimentos.obter(atendimentoId);
    if (!a || a[lado === 'cliente' ? 'clienteId' : 'diaristaId'] !== dono) throw new RegraDeNegocioViolada('NAO_ENCONTRADO', 'Atendimento não encontrado.');
    const existentes = await dep.avaliacoes.doAtendimento(a.id);
    const av = novaAvaliacao({ atendimento: a, lado, nota, comentario, agora: dep.relogio.agora(),
      jaAvaliado: Boolean(lado === 'cliente' ? existentes.doCliente : existentes.daDiarista) });
    const cliente = await dep.clientes.obter(a.clienteId);
    await dep.avaliacoes.salvar(av, { clienteId: a.clienteId, diaristaId: a.diaristaId, publica: lado === 'cliente' ? avaliacaoPublica(av, cliente) : null });
    return av;
  }

  return {
    /** Atendimentos concluídos nos últimos 30 dias que ainda esperam a avaliação deste lado. */
    async pendentesDeAvaliacao({ clienteId, diaristaId }) {
      const lista = clienteId ? await dep.atendimentos.listarPorCliente(clienteId) : await dep.atendimentos.listarPorDiarista(diaristaId);
      const limite = dep.relogio.agora().getTime() - PRAZO_AVALIACAO_DIAS * 864e5;
      const saida = [];
      for (const a of lista.filter((x) => x.status === STATUS.CONCLUIDO && new Date(x.concluidoEm ?? x.inicio).getTime() >= limite)
        .sort((x, y) => y.inicio - x.inicio)) {
        const ex = await dep.avaliacoes.doAtendimento(a.id);
        if (clienteId ? ex.doCliente : ex.daDiarista) continue;
        const outro = clienteId ? await dep.diaristas.obter(a.diaristaId) : await dep.clientes.obter(a.clienteId);
        saida.push({ atendimentoId: a.id, inicio: a.inicio, com: outro?.nome ?? '?' });
      }
      return saida;
    },
    avaliarProfissional: (p) => avaliar('cliente', p, p.clienteId),
    avaliarCliente: (p) => avaliar('diarista', p, p.diaristaId),
    async avaliacoesDoAtendimento(atendimentoId) { return dep.avaliacoes.doAtendimento(atendimentoId); },
  };
}
