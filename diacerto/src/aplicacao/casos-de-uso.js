import {
  calcularAtendimento, validarPrecosDaDiarista, verificarLimiteSemanal, verificarJanela,
  calcularCancelamentoPeloCliente, novoAtendimento, mudarStatus, confirmarChegada,
  STATUS, STATUS_ATIVOS, RegraDeNegocioViolada, PARAMETROS_PADRAO,
} from '../dominio/index.js';
import { chaveDia, deChave } from './datas.js';
import { criarCasosDeCadastro } from './cadastro.js';
import { criarCasosDeOperacao } from './operacao.js';

const HORAS = { diaria: 8, meiaDiaria: 4 };

function media(avaliacoes) {
  if (!avaliacoes.length) return null;
  return Math.round((avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length) * 10) / 10;
}

/**
 * Monta os casos de uso com as dependências injetadas (raiz de composição fica na apresentação).
 * @param {{diaristas:import('./portas.js').RepositorioDiaristas, clientes:import('./portas.js').RepositorioClientes,
 *   atendimentos:import('./portas.js').RepositorioAtendimentos, pacotes:import('./portas.js').RepositorioPacotes,
 *   cupons:import('./portas.js').ServicoCupons, pagamento:import('./portas.js').ServicoPagamento,
 *   notificador:import('./portas.js').Notificador, relogio:import('./portas.js').Relogio,
 *   ids:import('./portas.js').GeradorDeIds, parametros?:typeof PARAMETROS_PADRAO}} dep
 */
export function criarCasosDeUso(dep) {
  const parametros = dep.parametros ?? PARAMETROS_PADRAO;

  function precoDe(diarista, duracao, modalidade, cupom = 0) {
    return calcularAtendimento({
      servico: diarista.precos[duracao], transporte: diarista.precos.transporte,
      modalidade, descontoPacote: diarista.precos.descontoPacote, cupom,
    }, parametros);
  }

  async function diasOcupados(diaristaId) {
    const lista = await dep.atendimentos.listarPorDiarista(diaristaId);
    return new Set(lista.filter((a) => [STATUS.SOLICITADO, STATUS.ACEITO].includes(a.status)).map((a) => chaveDia(a.inicio)));
  }

  /** Dias com agenda aberta, a partir de amanhã, sem pedido ou atendimento marcado. */
  async function horariosLivres(d, limite) {
    const ocupados = await diasOcupados(d.id);
    const hoje = deChave(chaveDia(dep.relogio.agora()));
    return Object.entries(d.disponibilidade)
      .filter(([k]) => deChave(k) > hoje && !ocupados.has(k))
      .sort(([a], [b]) => a.localeCompare(b)).slice(0, limite)
      .map(([data, j]) => ({ data, ...j }));
  }

  async function concluidosCom(diaristaId) {
    const lista = await dep.atendimentos.listarPorDiarista(diaristaId);
    return lista.filter((a) => a.status === STATUS.CONCLUIDO).length;
  }

  function resumo(diarista, concluidos, duracao) {
    return {
      id: diarista.id, nome: diarista.nome, iniciais: diarista.iniciais,
      nota: media(diarista.avaliacoes), atendimentos: concluidos,
      anosExperiencia: diarista.anosExperiencia, tarefas: diarista.tarefas, regioes: diarista.regioes,
      verificada: Boolean(diarista.verificacao), duracao, horas: HORAS[duracao],
      totalAvulso: precoDe(diarista, duracao, 'avulso').totalCliente,
    };
  }

  const casos = {
    ...(dep.candidaturas ? criarCasosDeCadastro(dep) : {}),
    ...(dep.ocorrencias ? criarCasosDeOperacao(dep) : {}),
    /** @param {{regiao?:string, data?:string, duracao?:'diaria'|'meiaDiaria'|'todas'}} f */
    async buscarProfissionais(f = {}) {
      const lista = await dep.diaristas.listar({ regiao: f.regiao });
      const duracoes = f.duracao && f.duracao !== 'todas' ? [f.duracao] : ['diaria', 'meiaDiaria'];
      const saida = [];
      for (const d of lista) {
        let duracao = duracoes[0];
        if (f.data) {
          const janela = d.disponibilidade[f.data];
          if (!janela || (await diasOcupados(d.id)).has(f.data)) continue;
          duracao = duracoes.find((du) => janela.fim - janela.inicio >= HORAS[du] + (du === 'diaria' ? 1 : 0));
          if (!duracao) continue;
        }
        saida.push(resumo(d, await concluidosCom(d.id), duracao));
      }
      return saida;
    },

    async obterPerfil(diaristaId, duracao = 'diaria') {
      const d = await dep.diaristas.obter(diaristaId);
      if (!d) throw new RegraDeNegocioViolada('NAO_ENCONTRADA', 'Profissional não encontrada.');
      return {
        ...resumo(d, await concluidosCom(d.id), duracao),
        naoFaz: d.naoFaz, verificacao: d.verificacao, avaliacoes: d.avaliacoes,
        avulso: precoDe(d, duracao, 'avulso'),
        pacote: { ...precoDe(d, duracao, 'pacote'), quantidade: parametros.pacote.quantidade,
          validadeMeses: parametros.pacote.validadeMeses, desconto: d.precos.descontoPacote },
        proximosHorarios: await horariosLivres(d, 6),
      };
    },

    async simularReserva({ diaristaId, clienteId, duracao = 'diaria', modalidade = 'avulso', codigoCupom }) {
      const d = await dep.diaristas.obter(diaristaId);
      const pacote = clienteId ? await dep.pacotes.obterAtivo(clienteId, diaristaId) : null;
      const efetiva = pacote ? 'pacote' : modalidade;
      const cupom = codigoCupom ? (await dep.cupons.valor(codigoCupom, clienteId)) : 0;
      if (codigoCupom && cupom === null) throw new RegraDeNegocioViolada('CUPOM_INVALIDO', 'Cupom inválido ou expirado.');
      return { modalidade: efetiva, pacoteAtivo: pacote, valores: precoDe(d, duracao, efetiva, cupom ?? 0) };
    },

    async solicitarReserva(p) {
      const d = await dep.diaristas.obter(p.diaristaId);
      const c = await dep.clientes.obter(p.clienteId);
      if (!d || !c) throw new RegraDeNegocioViolada('NAO_ENCONTRADA', 'Cadastro não encontrado.');
      const horaFim = p.horaInicio + HORAS[p.duracao] + (p.duracao === 'diaria' ? 1 : 0); // 1h de intervalo na diária
      verificarJanela(p.horaInicio, horaFim, parametros);
      const janela = d.disponibilidade[p.data];
      if (!janela || p.horaInicio < janela.inicio || horaFim > janela.fim) {
        throw new RegraDeNegocioViolada('INDISPONIVEL', 'A profissional não tem esse horário livre.');
      }
      const daDupla = (await dep.atendimentos.listarPorCliente(c.id))
        .filter((a) => a.diaristaId === d.id && STATUS_ATIVOS.includes(a.status));
      const inicio = deChave(p.data, p.horaInicio);
      verificarLimiteSemanal(inicio, daDupla.map((a) => a.inicio), parametros);
      const ocupado = (await dep.atendimentos.listarPorDiarista(d.id))
        .some((a) => chaveDia(a.inicio) === p.data && [STATUS.SOLICITADO, STATUS.ACEITO].includes(a.status));
      if (ocupado) throw new RegraDeNegocioViolada('INDISPONIVEL', 'A profissional já tem um pedido nesse dia.');

      if (p.modalidade === 'pacote' && !(await dep.pacotes.obterAtivo(c.id, d.id))) {
        // Contratação do pacote. No piloto real, o valor dos N atendimentos é pré-autorizado
        // no provedor de pagamento e liberado a cada atendimento concluído.
        const validade = new Date(dep.relogio.agora());
        validade.setMonth(validade.getMonth() + parametros.pacote.validadeMeses);
        await dep.pacotes.salvar({ id: dep.ids.novo(), clienteId: c.id, diaristaId: d.id,
          total: parametros.pacote.quantidade, usados: 0, validade });
      }
      const sim = await casos.simularReserva({ diaristaId: d.id, clienteId: c.id, duracao: p.duracao, modalidade: p.modalidade, codigoCupom: p.codigoCupom });
      const atendimento = novoAtendimento({
        id: dep.ids.novo(), clienteId: c.id, diaristaId: d.id, inicio, horaInicio: p.horaInicio, horaFim,
        duracao: p.duracao, modalidade: sim.modalidade, valores: sim.valores, metodo: p.metodo,
        observacoes: (p.observacoes ?? '').slice(0, 500), codigoConfirmacao: dep.ids.codigo(),
      });
      await dep.atendimentos.salvar(atendimento);
      await dep.notificador.enviar({ para: d.id, canal: 'whatsapp', texto: `Novo pedido de ${c.nome} para ${p.data}.` });
      return atendimento;
    },

    /** A cobrança só acontece depois do aceite da diarista. */
    async responderPedido({ atendimentoId, diaristaId, aceitar }) {
      const a = await dep.atendimentos.obter(atendimentoId);
      if (!a || a.diaristaId !== diaristaId) throw new RegraDeNegocioViolada('NAO_ENCONTRADO', 'Pedido não encontrado.');
      if (!aceitar) {
        const recusado = mudarStatus(a, STATUS.RECUSADO);
        await dep.atendimentos.salvar(recusado);
        await dep.notificador.enviar({ para: a.clienteId, canal: 'whatsapp', texto: 'A profissional não pode atender nessa data.' });
        return recusado;
      }
      const { autorizacao } = await dep.pagamento.autorizar({ atendimentoId: a.id, valor: a.valores.totalCliente, metodo: a.metodo });
      const aceito = { ...mudarStatus(a, STATUS.ACEITO), autorizacao };
      await dep.atendimentos.salvar(aceito);
      if (aceito.modalidade === 'pacote') {
        const pacote = await dep.pacotes.obterAtivo(a.clienteId, a.diaristaId);
        if (pacote) await dep.pacotes.salvar({ ...pacote, usados: pacote.usados + 1 });
      }
      await dep.notificador.enviar({ para: a.clienteId, canal: 'whatsapp', texto: 'Pedido aceito.' });
      return aceito;
    },

    async confirmarChegada({ atendimentoId, codigo }) {
      const a = await dep.atendimentos.obter(atendimentoId);
      const atualizado = confirmarChegada(a, codigo);
      await dep.atendimentos.salvar(atualizado);
      return atualizado;
    },

    /** Conclusão libera o repasse via split do provedor. */
    async concluirAtendimento({ atendimentoId }) {
      const a = await dep.atendimentos.obter(atendimentoId);
      const concluido = mudarStatus(a, STATUS.CONCLUIDO);
      await dep.pagamento.capturarComSplit({ autorizacao: a.autorizacao, repasseDiarista: a.valores.recebeDiarista });
      await dep.atendimentos.salvar({ ...concluido, concluidoEm: dep.relogio.agora() });
      return concluido;
    },

    async cancelarPeloCliente({ atendimentoId, clienteId }) {
      const a = await dep.atendimentos.obter(atendimentoId);
      if (!a || a.clienteId !== clienteId) throw new RegraDeNegocioViolada('NAO_ENCONTRADO', 'Reserva não encontrada.');
      const calc = a.status === STATUS.SOLICITADO
        ? { gratuito: true, reembolsoCliente: a.valores.totalCliente, devidoDiarista: 0 }
        : calcularCancelamentoPeloCliente({ ...a, totalCliente: a.valores.totalCliente, recebeDiarista: a.valores.recebeDiarista }, dep.relogio.agora(), parametros);
      const cancelado = mudarStatus(a, STATUS.CANCELADO);
      if (a.autorizacao) await dep.pagamento.estornar({ autorizacao: a.autorizacao, valor: calc.reembolsoCliente });
      await dep.atendimentos.salvar(cancelado);
      return { ...cancelado, ...calc };
    },

    async minhasDiaristas(clienteId) {
      const lista = await dep.atendimentos.listarPorCliente(clienteId);
      const hoje = deChave(chaveDia(dep.relogio.agora()));
      const porDiarista = new Map();
      for (const a of lista) {
        if (!porDiarista.has(a.diaristaId)) porDiarista.set(a.diaristaId, []);
        porDiarista.get(a.diaristaId).push(a);
      }
      const saida = [];
      for (const [id, ats] of porDiarista) {
        const d = await dep.diaristas.obter(id);
        const concluidos = ats.filter((a) => a.status === STATUS.CONCLUIDO).sort((x, y) => y.inicio - x.inicio);
        const proximo = ats.filter((a) => [STATUS.SOLICITADO, STATUS.ACEITO].includes(a.status) && a.inicio >= hoje)
          .sort((x, y) => x.inicio - y.inicio)[0] ?? null;
        const pacote = await dep.pacotes.obterAtivo(clienteId, id);
        const livres = await horariosLivres(d, 2);
        saida.push({ diarista: { id: d.id, nome: d.nome, iniciais: d.iniciais }, vezes: concluidos.length,
          ultima: concluidos[0]?.inicio ?? null, proximo, pacote, proximosLivres: livres });
      }
      return saida.sort((x, y) => y.vezes - x.vezes);
    },

    async painelDiarista(diaristaId) {
      const d = await dep.diaristas.obter(diaristaId);
      const ats = await dep.atendimentos.listarPorDiarista(diaristaId);
      const agora = dep.relogio.agora();
      const nomes = new Map();
      for (const a of ats) if (!nomes.has(a.clienteId)) nomes.set(a.clienteId, (await dep.clientes.obter(a.clienteId))?.nome ?? 'Cliente');
      const comNome = (a) => ({ ...a, clienteNome: nomes.get(a.clienteId) });
      const mesAtual = (a) => a.concluidoEm && a.concluidoEm.getMonth() === agora.getMonth() && a.concluidoEm.getFullYear() === agora.getFullYear();
      const concluidos = ats.filter((a) => a.status === STATUS.CONCLUIDO).sort((x, y) => y.inicio - x.inicio);
      return {
        diarista: d,
        pendentes: ats.filter((a) => a.status === STATUS.SOLICITADO).sort((x, y) => x.inicio - y.inicio).map(comNome),
        agendados: ats.filter((a) => a.status === STATUS.ACEITO).sort((x, y) => x.inicio - y.inicio).map(comNome),
        recebidoNoMes: concluidos.filter(mesAtual).reduce((s, a) => s + a.valores.recebeDiarista, 0),
        atendimentosNoMes: concluidos.filter(mesAtual).length,
        ultimosRecebimentos: concluidos.slice(0, 5).map(comNome),
        simulacao: { avulso: precoDe(d, 'diaria', 'avulso'), pacote: precoDe(d, 'diaria', 'pacote') },
        piso: parametros.piso, janela: parametros.janela,
      };
    },

    async atualizarPrecos(diaristaId, precos) {
      const d = await dep.diaristas.obter(diaristaId);
      validarPrecosDaDiarista(precos, parametros);
      await dep.diaristas.salvar({ ...d, precos: { ...precos } });
      return { avulso: precoDe({ ...d, precos }, 'diaria', 'avulso'), pacote: precoDe({ ...d, precos }, 'diaria', 'pacote') };
    },

    async definirDisponibilidade(diaristaId, data, janela) {
      const d = await dep.diaristas.obter(diaristaId);
      const disp = { ...d.disponibilidade };
      if (janela) { verificarJanela(janela.inicio, janela.fim, parametros); disp[data] = janela; } else delete disp[data];
      await dep.diaristas.salvar({ ...d, disponibilidade: disp });
      return disp;
    },
  };
  return casos;
}
