import {
  novaOcorrencia, resolverOcorrencia, calcularIndicadores, RegraDeNegocioViolada, PARAMETROS_PADRAO,
} from '../dominio/index.js';

/**
 * Casos de uso do painel da operação: atendimentos, ocorrências, reembolsos e indicadores.
 * @param {{atendimentos:import('./portas.js').RepositorioAtendimentos, ocorrencias:import('./portas.js').RepositorioOcorrencias,
 *   clientes:import('./portas.js').RepositorioClientes, diaristas:import('./portas.js').RepositorioDiaristas,
 *   pagamento:import('./portas.js').ServicoPagamento, notificador:import('./portas.js').Notificador,
 *   relogio:import('./portas.js').Relogio, ids:import('./portas.js').GeradorDeIds, parametros?:typeof PARAMETROS_PADRAO}} dep
 */
export function criarCasosDeOperacao(dep) {
  const parametros = dep.parametros ?? PARAMETROS_PADRAO;

  async function nomes(lista) {
    const cache = new Map();
    const nome = async (repo, id) => {
      if (!cache.has(id)) cache.set(id, (await repo.obter(id))?.nome ?? '?');
      return cache.get(id);
    };
    const saida = [];
    for (const a of lista) saida.push({ ...a, clienteNome: await nome(dep.clientes, a.clienteId), diaristaNome: await nome(dep.diaristas, a.diaristaId) });
    return saida;
  }

  return {
    async listarAtendimentosOperacao({ status } = {}) {
      const todos = await dep.atendimentos.listarTodos();
      const ocorrencias = await dep.ocorrencias.listar();
      const filtrados = todos.filter((a) => !status || status === 'todos' || a.status === status)
        .sort((x, y) => y.inicio - x.inicio);
      return (await nomes(filtrados)).map((a) => ({ ...a, ocorrencias: ocorrencias.filter((o) => o.atendimentoId === a.id).length }));
    },

    async obterAtendimentoOperacao(id) {
      const a = await dep.atendimentos.obter(id);
      if (!a) throw new RegraDeNegocioViolada('NAO_ENCONTRADO', 'Atendimento não encontrado.');
      const [comNomes] = await nomes([a]);
      const ocorrencias = (await dep.ocorrencias.listar()).filter((o) => o.atendimentoId === id)
        .sort((x, y) => new Date(y.abertaEm) - new Date(x.abertaEm));
      return { ...comNomes, ocorrencias };
    },

    async registrarOcorrencia(d) {
      const a = await dep.atendimentos.obter(d.atendimentoId);
      if (!a) throw new RegraDeNegocioViolada('NAO_ENCONTRADO', 'Atendimento não encontrado.');
      const o = novaOcorrencia({ ...d, id: dep.ids.novo(), abertaEm: dep.relogio.agora() });
      await dep.ocorrencias.salvar(o);
      if (o.gravidade === 'grave') {
        await dep.notificador.enviar({ para: 'operacao', canal: 'email', texto: `Ocorrência grave aberta no atendimento ${a.id}. Responder em até 72h.` });
      }
      return o;
    },

    async listarOcorrencias({ status } = {}) {
      const lista = (await dep.ocorrencias.listar()).filter((o) => !status || status === 'todas' || o.status === status);
      const agora = dep.relogio.agora().getTime();
      const peso = { grave: 0, moderada: 1, leve: 2 };
      const saida = [];
      for (const o of lista.sort((x, y) => (x.status === y.status ? 0 : x.status === 'aberta' ? -1 : 1)
        || peso[x.gravidade] - peso[y.gravidade] || new Date(x.abertaEm) - new Date(y.abertaEm))) {
        const a = await dep.atendimentos.obter(o.atendimentoId);
        const [comNomes] = a ? await nomes([a]) : [null];
        saida.push({ ...o, horasAberta: Math.floor((agora - new Date(o.abertaEm).getTime()) / 36e5), atendimento: comNomes });
      }
      return saida;
    },

    /** Reembolso aprovado é devolvido ao cliente pelo provedor; nada é descontado da diarista. */
    async resolverOcorrencia({ ocorrenciaId, resolucao, reembolso = 0 }) {
      const o = (await dep.ocorrencias.listar()).find((x) => x.id === ocorrenciaId);
      if (!o) throw new RegraDeNegocioViolada('NAO_ENCONTRADA', 'Ocorrência não encontrada.');
      const a = await dep.atendimentos.obter(o.atendimentoId);
      const resolvida = resolverOcorrencia(o, { resolucao, reembolso, totalPago: a?.valores.totalCliente ?? 0, agora: dep.relogio.agora() });
      if (resolvida.reembolso > 0) {
        await dep.pagamento.estornar({ autorizacao: a?.autorizacao ?? null, valor: resolvida.reembolso, motivo: `ocorrencia:${o.id}` });
      }
      await dep.ocorrencias.salvar(resolvida);
      await dep.notificador.enviar({ para: a?.clienteId ?? 'cliente', canal: 'whatsapp', texto: 'Sua ocorrência foi resolvida.' });
      return resolvida;
    },

    async indicadoresDoPiloto() {
      return calcularIndicadores({
        atendimentos: await dep.atendimentos.listarTodos(),
        ocorrencias: await dep.ocorrencias.listar(),
        agora: dep.relogio.agora(),
      }, parametros);
    },
  };
}
