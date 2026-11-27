import {
  calcularAtendimento, validarPrecosDaDiarista, verificarLimiteSemanal, verificarJanela,
  calcularCancelamentoPeloCliente, novoAtendimento, mudarStatus, confirmarChegada, remarcarAtendimento,
  novoPacote, situacaoDoPacote, encerrarPacote as fecharPacote, aplicarParametros,
  STATUS, STATUS_ATIVOS, RegraDeNegocioViolada, PARAMETROS_PADRAO,
} from '../dominio/index.js';
import { chaveDia, deChave } from './datas.js';
import { criarCasosDeCadastro } from './cadastro.js';
import { criarCasosDeOperacao } from './operacao.js';
import { criarCasosDeAcesso } from './acessos.js';
import { criarCasosDeAvaliacao } from './avaliacoes.js';
import { criarCasosDeParametros } from './parametros.js';

const HORAS = { diaria: 8, meiaDiaria: 4 };

function media(avaliacoes) {
  if (!avaliacoes.length) return null;
  return Math.round((avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length) * 10) / 10;
}

/**
 * Monta os casos de uso com as dependências injetadas (raiz de composição fica na apresentação).
 * Com `configuracao`, cada chamada usa os parâmetros comerciais vigentes naquele momento (RF7).
 * @param {{diaristas:import('./portas.js').RepositorioDiaristas, clientes:import('./portas.js').RepositorioClientes,
 *   atendimentos:import('./portas.js').RepositorioAtendimentos, pacotes:import('./portas.js').RepositorioPacotes,
 *   cupons:import('./portas.js').ServicoCupons, pagamento:import('./portas.js').ServicoPagamento,
 *   notificador:import('./portas.js').Notificador, relogio:import('./portas.js').Relogio,
 *   ids:import('./portas.js').GeradorDeIds, configuracao?:import('./portas.js').RepositorioParametros,
 *   parametros?:typeof PARAMETROS_PADRAO}} dep
 */
export function criarCasosDeUso(dep) {
  if (!dep.configuracao) return montarCasos(dep);
  const nomes = Object.keys(montarCasos({ ...dep, parametros: PARAMETROS_PADRAO }));
  // Um conjunto novo de casos por chamada: nenhuma chamada vê parâmetros trocados no meio do caminho.
  return Object.fromEntries(nomes.map((nome) => [nome, async (...args) => {
    const vigente = await dep.configuracao.vigente();
    const parametros = aplicarParametros(dep.parametros ?? PARAMETROS_PADRAO, vigente?.valores);
    return montarCasos({ ...dep, parametros })[nome](...args);
  }]));
}

function montarCasos(dep) {
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

  /** Pacotes do cliente com saldo e situação calculados pelos atendimentos. */
  async function pacotesDoCliente(clienteId) {
    const [pacotes, atendimentos] = await Promise.all([dep.pacotes.listarPorCliente(clienteId), dep.atendimentos.listarPorCliente(clienteId)]);
    const agora = dep.relogio.agora();
    return pacotes.map((p) => situacaoDoPacote(p, atendimentos, agora));
  }

  async function pacoteDisponivel(clienteId, diaristaId, duracao) {
    if (!clienteId) return null;
    return (await pacotesDoCliente(clienteId))
      .filter((p) => p.disponivel && p.diaristaId === diaristaId && (!duracao || p.duracao === duracao))
      .sort((a, b) => new Date(a.validade) - new Date(b.validade))[0] ?? null;
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
    ...(dep.perfis ? criarCasosDeAcesso(dep) : {}),
    ...(dep.avaliacoes ? criarCasosDeAvaliacao(dep) : {}),
    ...(dep.configuracao ? criarCasosDeParametros(dep) : {}),
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

    async simularReserva({ diaristaId, clienteId, duracao = 'diaria', codigoCupom }) {
      const d = await dep.diaristas.obter(diaristaId);
      if (!d) throw new RegraDeNegocioViolada('NAO_ENCONTRADA', 'Profissional não encontrada.');
      const pacote = await pacoteDisponivel(clienteId, diaristaId, duracao);
      if (pacote) {
        // atendimento pelo pacote: preço e política de cancelamento travados na compra, já pago; cupom não se aplica
        return { modalidade: 'pacote', pacoteAtivo: pacote, valores: { ...pacote.unitario },
          politicaCancelamento: { ...(pacote.politicaCancelamento ?? parametros.cancelamento) } };
      }
      const politicaCancelamento = { ...parametros.cancelamento };
      const cupom = codigoCupom ? (await dep.cupons.valor(codigoCupom, clienteId)) : 0;
      if (codigoCupom && cupom === null) throw new RegraDeNegocioViolada('CUPOM_INVALIDO', 'Cupom inválido ou expirado.');
      return { modalidade: 'avulso', pacoteAtivo: null, valores: precoDe(d, duracao, 'avulso', cupom ?? 0), politicaCancelamento };
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

      const sim = await casos.simularReserva({ diaristaId: d.id, clienteId: c.id, duracao: p.duracao, codigoCupom: p.codigoCupom });
      if (p.modalidade === 'pacote' && sim.modalidade !== 'pacote') {
        throw new RegraDeNegocioViolada('SEM_PACOTE', 'Você não tem pacote com saldo com esta profissional para esta duração. Compre o pacote antes de agendar por ele.');
      }
      const atendimento = novoAtendimento({
        id: dep.ids.novo(), clienteId: c.id, diaristaId: d.id, inicio, horaInicio: p.horaInicio, horaFim,
        duracao: p.duracao, modalidade: sim.modalidade, valores: sim.valores, metodo: sim.pacoteAtivo?.metodo ?? p.metodo,
        observacoes: (p.observacoes ?? '').slice(0, 500), codigoConfirmacao: dep.ids.codigo(),
        pacoteId: sim.pacoteAtivo?.id ?? null, autorizacao: sim.pacoteAtivo?.autorizacao ?? undefined,
        politicaCancelamento: sim.politicaCancelamento, taxaCancelamento: 0,
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
        // remarcação recusada: a cobrança já autorizada volta inteira (no pacote, o atendimento volta ao saldo)
        if (a.autorizacao && !a.pacoteId) await dep.pagamento.estornar({ autorizacao: a.autorizacao, valor: a.valores.totalCliente, motivo: `recusa:${a.id}` });
        await dep.atendimentos.salvar(recusado);
        await dep.notificador.enviar({ para: a.clienteId, canal: 'whatsapp', texto: 'A profissional não pode atender nessa data.' });
        return recusado;
      }
      // pacote (já pago) ou remarcação (já autorizada): não cobra de novo
      const autorizacao = a.autorizacao
        ?? (await dep.pagamento.autorizar({ atendimentoId: a.id, valor: a.valores.totalCliente, metodo: a.metodo })).autorizacao;
      const aceito = { ...mudarStatus(a, STATUS.ACEITO), autorizacao };
      await dep.atendimentos.salvar(aceito);
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

    /** O que acontece se o cliente cancelar agora (sem cancelar). */
    async simularCancelamento({ atendimentoId, clienteId }) {
      const a = await dep.atendimentos.obter(atendimentoId);
      if (!a || a.clienteId !== clienteId) throw new RegraDeNegocioViolada('NAO_ENCONTRADO', 'Reserva não encontrada.');
      if (![STATUS.SOLICITADO, STATUS.ACEITO].includes(a.status)) throw new RegraDeNegocioViolada('NAO_CANCELAVEL', 'Esta reserva não pode mais ser cancelada.');
      const calc = a.status === STATUS.SOLICITADO
        ? { gratuito: true, reembolsoCliente: a.valores.totalCliente, devidoDiarista: 0 }
        : calcularCancelamentoPeloCliente({ inicio: a.inicio, totalCliente: a.valores.totalCliente, recebeDiarista: a.valores.recebeDiarista,
          politicaCancelamento: a.politicaCancelamento }, dep.relogio.agora(), parametros);
      // pelo pacote, o cancelamento sem custo devolve o atendimento ao saldo, não dinheiro
      return a.pacoteId && calc.gratuito ? { ...calc, reembolsoCliente: 0, voltaAoPacote: true } : { ...calc, voltaAoPacote: false };
    },

    async remarcarAtendimento({ atendimentoId, clienteId, data, horaInicio }) {
      const a = await dep.atendimentos.obter(atendimentoId);
      if (!a || a.clienteId !== clienteId) throw new RegraDeNegocioViolada('NAO_ENCONTRADO', 'Reserva não encontrada.');
      const d = await dep.diaristas.obter(a.diaristaId);
      const horaFim = horaInicio + HORAS[a.duracao] + (a.duracao === 'diaria' ? 1 : 0);
      verificarJanela(horaInicio, horaFim, parametros);
      const janela = d.disponibilidade[data];
      if (!janela || horaInicio < janela.inicio || horaFim > janela.fim) {
        throw new RegraDeNegocioViolada('INDISPONIVEL', 'A profissional não tem esse horário livre.');
      }
      if ((await diasOcupados(d.id)).has(data) && chaveDia(a.inicio) !== data) {
        throw new RegraDeNegocioViolada('INDISPONIVEL', 'A profissional já tem um pedido nesse dia.');
      }
      const novoInicio = deChave(data, horaInicio);
      const daDupla = (await dep.atendimentos.listarPorCliente(clienteId))
        .filter((x) => x.id !== a.id && x.diaristaId === d.id && STATUS_ATIVOS.includes(x.status));
      verificarLimiteSemanal(novoInicio, daDupla.map((x) => x.inicio), parametros);
      const remarcado = remarcarAtendimento(a, { inicio: novoInicio, horaInicio, horaFim, agora: dep.relogio.agora() });
      await dep.atendimentos.salvar(remarcado);
      await dep.notificador.enviar({ para: d.id, canal: 'whatsapp', texto: `Pedido remarcado para ${data}. Confirme se pode atender.` });
      return remarcado;
    },

    /** Atendimentos recentes e próximos de quem pede ajuda (cliente ou diarista). */
    async meusAtendimentos({ clienteId, diaristaId }) {
      const lista = clienteId ? await dep.atendimentos.listarPorCliente(clienteId) : await dep.atendimentos.listarPorDiarista(diaristaId);
      const limite = deChave(chaveDia(dep.relogio.agora())).getTime() - 30 * 864e5;
      const saida = [];
      for (const a of lista.filter((x) => x.inicio.getTime() >= limite && x.status !== STATUS.RECUSADO).sort((x, y) => y.inicio - x.inicio)) {
        const outro = clienteId ? await dep.diaristas.obter(a.diaristaId) : await dep.clientes.obter(a.clienteId);
        saida.push({ id: a.id, inicio: a.inicio, horaInicio: a.horaInicio, horaFim: a.horaFim, status: a.status, com: outro?.nome ?? '?' });
      }
      return saida;
    },

    async cancelarPeloCliente({ atendimentoId, clienteId }) {
      const calc = await casos.simularCancelamento({ atendimentoId, clienteId });
      const a = await dep.atendimentos.obter(atendimentoId);
      const cancelado = { ...mudarStatus(a, STATUS.CANCELADO), taxaCancelamento: calc.devidoDiarista };
      if (a.autorizacao && calc.reembolsoCliente > 0) {
        await dep.pagamento.estornar({ autorizacao: a.autorizacao, valor: calc.reembolsoCliente, motivo: `cancelamento:${a.id}` });
      }
      if (a.autorizacao && calc.devidoDiarista > 0) {
        await dep.pagamento.capturarComSplit({ autorizacao: a.autorizacao, repasseDiarista: calc.devidoDiarista, motivo: `cancelamento-tardio:${a.id}` });
      }
      await dep.atendimentos.salvar(cancelado);
      await dep.notificador.enviar({ para: a.diaristaId, canal: 'whatsapp', texto: 'Um atendimento foi cancelado pelo cliente.' });
      return { ...cancelado, ...calc };
    },

    /** Compra explícita do pacote: paga de uma vez, preço travado, validade a partir de hoje. */
    async comprarPacote({ clienteId, diaristaId, duracao = 'diaria', metodo = 'pix' }) {
      const [c, d] = await Promise.all([dep.clientes.obter(clienteId), dep.diaristas.obter(diaristaId)]);
      if (!c || !d) throw new RegraDeNegocioViolada('NAO_ENCONTRADA', 'Cadastro não encontrado.');
      if (await pacoteDisponivel(clienteId, diaristaId, duracao)) {
        throw new RegraDeNegocioViolada('PACOTE_ATIVO', 'Você já tem um pacote com saldo com esta profissional. Use esse antes de comprar outro.');
      }
      const pacote = novoPacote({ id: dep.ids.novo(), clienteId, diaristaId, duracao, precos: d.precos, metodo, agora: dep.relogio.agora() }, parametros);
      const { autorizacao } = await dep.pagamento.autorizar({ pacoteId: pacote.id, valor: pacote.totalPago, metodo: pacote.metodo });
      const comprado = { ...pacote, autorizacao };
      await dep.pacotes.salvar(comprado);
      await dep.notificador.enviar({ para: d.id, canal: 'whatsapp', texto: `${c.nome} comprou um pacote de ${pacote.total} atendimentos com você.` });
      return situacaoDoPacote(comprado, [], dep.relogio.agora());
    },

    async meusPacotes({ clienteId }) {
      const lista = await pacotesDoCliente(clienteId);
      const saida = [];
      for (const p of lista) saida.push({ ...p, diaristaNome: (await dep.diaristas.obter(p.diaristaId))?.nome ?? '?' });
      const peso = (p) => (p.status === 'ativo' && !p.vencido ? 0 : p.status === 'ativo' ? 1 : 2);
      return saida.sort((a, b) => peso(a) - peso(b) || new Date(b.compradoEm) - new Date(a.compradoEm));
    },

    /** Encerra e devolve o saldo; em até 7 dias sem uso, é a desistência (tudo volta). */
    async encerrarPacote({ pacoteId, clienteId }) {
      const p = (await pacotesDoCliente(clienteId)).find((x) => x.id === pacoteId);
      if (!p) throw new RegraDeNegocioViolada('NAO_ENCONTRADO', 'Pacote não encontrado.');
      const encerrado = fecharPacote(p, dep.relogio.agora());
      await dep.pagamento.estornar({ autorizacao: p.autorizacao, valor: encerrado.reembolso, motivo: `${p.desistencia ? 'desistencia' : 'saldo'}-pacote:${p.id}` });
      await dep.pacotes.salvar(encerrado);
      return { ...encerrado, desistencia: p.desistencia };
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
        const pacote = await pacoteDisponivel(clienteId, id);
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
      const clientes = new Map();
      for (const a of ats) if (!clientes.has(a.clienteId)) clientes.set(a.clienteId, await dep.clientes.obter(a.clienteId));
      const comNome = (a) => ({ ...a, clienteNome: clientes.get(a.clienteId)?.nome ?? 'Cliente' });
      // o endereço só vai para a profissional depois que ela aceita o pedido
      const comEndereco = (a) => ({ ...comNome(a), clienteEndereco: clientes.get(a.clienteId)?.endereco ?? '' });
      const mesAtual = (a) => a.concluidoEm && a.concluidoEm.getMonth() === agora.getMonth() && a.concluidoEm.getFullYear() === agora.getFullYear();
      const concluidos = ats.filter((a) => a.status === STATUS.CONCLUIDO).sort((x, y) => y.inicio - x.inicio);
      return {
        diarista: d,
        pendentes: ats.filter((a) => a.status === STATUS.SOLICITADO).sort((x, y) => x.inicio - y.inicio).map(comNome),
        agendados: ats.filter((a) => a.status === STATUS.ACEITO).sort((x, y) => x.inicio - y.inicio).map(comEndereco),
        recebidoNoMes: concluidos.filter(mesAtual).reduce((s, a) => s + a.valores.recebeDiarista, 0),
        atendimentosNoMes: concluidos.filter(mesAtual).length,
        ultimosRecebimentos: concluidos.slice(0, 5).map(comNome),
        simulacao: { avulso: precoDe(d, 'diaria', 'avulso'), pacote: precoDe(d, 'diaria', 'pacote') },
        piso: parametros.piso, janela: parametros.janela, comissao: { ...parametros.comissao },
        pacote: { quantidade: parametros.pacote.quantidade, descontoMaximo: parametros.pacote.descontoMaximo },
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
