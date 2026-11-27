import {
  novaOcorrencia, resolverOcorrencia, calcularIndicadores, prazoDeContestacaoAberto, contestarConclusao, decidirRepasse,
  REPASSE, RegraDeNegocioViolada, PARAMETROS_PADRAO,
} from '../dominio/index.js';
import { comRepassesEmDia, pagarRepasse } from './repasses.js';

/**
 * Casos de uso do painel da operação: atendimentos, ocorrências, reembolsos e indicadores.
 * @param {{atendimentos:import('./portas.js').RepositorioAtendimentos, ocorrencias:import('./portas.js').RepositorioOcorrencias,
 *   clientes:import('./portas.js').RepositorioClientes, diaristas:import('./portas.js').RepositorioDiaristas,
 *   pagamento:import('./portas.js').ServicoPagamento, notificador:import('./portas.js').Notificador,
 *   relogio:import('./portas.js').Relogio, ids:import('./portas.js').GeradorDeIds, locais?:import('./portas.js').RepositorioLocais,
 *   parametros?:typeof PARAMETROS_PADRAO}} dep
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
      const todos = await comRepassesEmDia(dep, await dep.atendimentos.listarTodos());
      const ocorrencias = await dep.ocorrencias.listar();
      const filtrados = todos.filter((a) => !status || status === 'todos' || a.status === status)
        .sort((x, y) => y.inicio - x.inicio);
      return (await nomes(filtrados)).map((a) => ({ ...a, ocorrencias: ocorrencias.filter((o) => o.atendimentoId === a.id).length }));
    },

    async obterAtendimentoOperacao(id) {
      const encontrado = await dep.atendimentos.obter(id);
      if (!encontrado) throw new RegraDeNegocioViolada('NAO_ENCONTRADO', 'Atendimento não encontrado.');
      const [a] = await comRepassesEmDia(dep, [encontrado]);
      const [comNomes] = await nomes([a]);
      const ocorrencias = (await dep.ocorrencias.listar()).filter((o) => o.atendimentoId === id)
        .sort((x, y) => new Date(y.abertaEm) - new Date(x.abertaEm));
      // a operação vê o local para atender ocorrências (RF01)
      return { ...comNomes, ocorrencias, local: dep.locais ? await dep.locais.obter(id) : null };
    },

    async registrarOcorrencia(d) {
      const a = await dep.atendimentos.obter(d.atendimentoId);
      if (!a) throw new RegraDeNegocioViolada('NAO_ENCONTRADO', 'Atendimento não encontrado.');
      const agora = dep.relogio.agora();
      // relato do cliente dentro do prazo de confirmar a conclusão vale como contestação (RF03)
      const contesta = d.abertoPor === 'cliente' && prazoDeContestacaoAberto(a, agora);
      const o = novaOcorrencia({ ...d, id: dep.ids.novo(), abertaEm: agora, contestacao: contesta });
      await dep.ocorrencias.salvar(o);
      if (contesta) {
        await dep.atendimentos.salvar(contestarConclusao(a, agora));
        await dep.notificador.enviar({ para: a.diaristaId, canal: 'whatsapp', texto: 'O cliente relatou um problema no atendimento. O repasse fica em análise até a operação ouvir vocês.' });
      }
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

    /**
     * Reembolso aprovado é devolvido ao cliente pelo provedor; nada é descontado da diarista.
     * Se a ocorrência é a contestação de uma conclusão, a operação decide o repasse: liberar ou
     * reter (o cliente recebe de volta o valor do atendimento e a profissional não recebe).
     */
    async resolverOcorrencia({ ocorrenciaId, resolucao, reembolso = 0, repasse = null }) {
      const o = (await dep.ocorrencias.listar()).find((x) => x.id === ocorrenciaId);
      if (!o) throw new RegraDeNegocioViolada('NAO_ENCONTRADA', 'Ocorrência não encontrada.');
      const a = await dep.atendimentos.obter(o.atendimentoId);
      const agora = dep.relogio.agora();
      const resolvida = resolverOcorrencia(o, { resolucao, reembolso, totalPago: a?.valores.totalCliente ?? 0, agora });
      const decide = o.contestacao && a?.repasse?.status === REPASSE.CONTESTADO;
      const decidido = decide ? decidirRepasse(a, repasse, agora) : null;
      if (decidido?.repasse.status === REPASSE.RETIDO && resolvida.reembolso > 0) {
        throw new RegraDeNegocioViolada('REEMBOLSO', 'Ao reter o repasse, o cliente já recebe de volta o valor do atendimento. Não some outro reembolso.');
      }
      if (resolvida.reembolso > 0) {
        await dep.pagamento.estornar({ autorizacao: a?.autorizacao ?? null, valor: resolvida.reembolso, motivo: `ocorrencia:${o.id}` });
      }
      if (decidido?.repasse.status === REPASSE.LIBERADO) await pagarRepasse(dep, a);
      if (decidido?.repasse.status === REPASSE.RETIDO) {
        await dep.pagamento.estornar({ autorizacao: a.autorizacao, valor: a.valores.totalCliente, motivo: `repasse-retido:${a.id}` });
      }
      if (decidido) await dep.atendimentos.salvar(decidido);
      await dep.ocorrencias.salvar(resolvida);
      await dep.notificador.enviar({ para: a?.clienteId ?? 'cliente', canal: 'whatsapp', texto: 'Sua ocorrência foi resolvida.' });
      if (decidido) {
        await dep.notificador.enviar({ para: a.diaristaId, canal: 'whatsapp',
          texto: decidido.repasse.status === REPASSE.LIBERADO ? 'A análise terminou e o seu repasse foi liberado.' : 'A análise terminou e o repasse deste atendimento não será feito. Fale com a operação se quiser entender a decisão.' });
      }
      return { ...resolvida, repasse: decidido?.repasse.status ?? null };
    },

    async indicadoresDoPiloto() {
      return calcularIndicadores({
        atendimentos: await comRepassesEmDia(dep, await dep.atendimentos.listarTodos()),
        ocorrencias: await dep.ocorrencias.listar(),
        agora: dep.relogio.agora(),
      }, parametros);
    },
  };
}
