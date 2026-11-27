import {
  novaCandidatura, pendenciasDaCandidatura, iniciaisDe, nomePublico, normalizarEmail, novoPerfil,
  STATUS_CANDIDATURA, ITENS_VERIFICACAO, RESULTADOS, RegraDeNegocioViolada, PARAMETROS_PADRAO,
} from '../dominio/index.js';
import { chaveDia } from './datas.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ORDEM = { contato: 0, em_cadastro: 1, aprovada: 2, reprovada: 3 };
const EDITAVEIS = ['email', 'nome', 'celular', 'regioes', 'tarefas', 'naoFaz', 'anosExperiencia', 'precos', 'agenda'];

/**
 * Casos de uso do cadastro assistido de diaristas.
 * @param {{candidaturas:import('./portas.js').RepositorioCandidaturas, diaristas:import('./portas.js').RepositorioDiaristas,
 *   notificador:import('./portas.js').Notificador, relogio:import('./portas.js').Relogio, ids:import('./portas.js').GeradorDeIds,
 *   parametros?:typeof PARAMETROS_PADRAO}} dep
 */
export function criarCasosDeCadastro(dep) {
  const parametros = dep.parametros ?? PARAMETROS_PADRAO;

  async function carregar(id) {
    const c = await dep.candidaturas.obter(id);
    if (!c) throw new RegraDeNegocioViolada('NAO_ENCONTRADA', 'Candidatura não encontrada.');
    return c;
  }
  function exigirAberta(c) {
    if (c.status === STATUS_CANDIDATURA.APROVADA || c.status === STATUS_CANDIDATURA.REPROVADA) {
      throw new RegraDeNegocioViolada('ENCERRADA', 'Esta candidatura já foi encerrada.');
    }
  }
  const comPendencias = (c) => ({ ...c, pendencias: pendenciasDaCandidatura(c, parametros) });

  return {
    /** Pedido de contato feito pela própria candidata no site. */
    async solicitarContato({ nome, celular, regiao }) {
      const c = novaCandidatura({ id: dep.ids.novo(), nome, celular, regiao });
      await dep.candidaturas.salvar({ ...c, criadaEm: dep.relogio.agora() });
      await dep.notificador.enviar({ para: 'operacao', canal: 'email', texto: `Novo pedido de cadastro: ${c.nome}.` });
      return c;
    },

    /** Cadastro iniciado pela operação, já em andamento. */
    async iniciarCadastro({ nome, celular }) {
      const c = { ...novaCandidatura({ id: dep.ids.novo(), nome, celular }), status: STATUS_CANDIDATURA.EM_CADASTRO };
      await dep.candidaturas.salvar({ ...c, criadaEm: dep.relogio.agora() });
      return comPendencias(c);
    },

    async listarCandidaturas() {
      const lista = await dep.candidaturas.listar();
      return lista.map(comPendencias)
        .sort((a, b) => ORDEM[a.status] - ORDEM[b.status] || new Date(b.criadaEm) - new Date(a.criadaEm));
    },

    async obterCandidatura(id) { return comPendencias(await carregar(id)); },

    async atualizarCandidatura(id, alteracoes) {
      const c = await carregar(id);
      exigirAberta(c);
      const nova = { ...c, status: STATUS_CANDIDATURA.EM_CADASTRO };
      for (const campo of EDITAVEIS) if (campo in alteracoes) nova[campo] = alteracoes[campo];
      if ('celular' in alteracoes || 'nome' in alteracoes) novaCandidatura(nova); // revalida nome e celular
      if ('email' in alteracoes) {
        nova.email = alteracoes.email ? normalizarEmail(alteracoes.email) : null;
        const dono = nova.email && dep.perfis ? await dep.perfis.porEmail(nova.email) : null;
        if (dono) throw new RegraDeNegocioViolada('EMAIL_EM_USO', `O e-mail ${nova.email} já tem acesso como ${dono.papel}.`);
      }
      if (alteracoes.verificacao) {
        nova.verificacao = { ...c.verificacao };
        for (const [item, resultado] of Object.entries(alteracoes.verificacao)) {
          if (!ITENS_VERIFICACAO.some((i) => i.id === item) || !RESULTADOS.includes(resultado)) {
            throw new RegraDeNegocioViolada('VERIFICACAO', 'Item ou resultado de verificação inválido.');
          }
          nova.verificacao[item] = { resultado, data: resultado === 'pendente' ? null : chaveDia(dep.relogio.agora()) };
        }
      }
      await dep.candidaturas.salvar(nova);
      return comPendencias(nova);
    },

    async registrarAceiteDaConduta(id) {
      const c = await carregar(id);
      exigirAberta(c);
      const nova = { ...c, status: STATUS_CANDIDATURA.EM_CADASTRO, aceiteConduta: dep.relogio.agora().toISOString() };
      await dep.candidaturas.salvar(nova);
      return comPendencias(nova);
    },

    /** Aprovação cria o perfil da diarista e a agenda das próximas 3 semanas. */
    async aprovarCandidatura(id) {
      const c = await carregar(id);
      exigirAberta(c);
      const pendencias = pendenciasDaCandidatura(c, parametros);
      if (pendencias.length) throw new RegraDeNegocioViolada('PENDENCIAS', `Ainda falta: ${pendencias.join(' ')}`);
      const agora = dep.relogio.agora();
      const disponibilidade = {};
      for (let i = 1; i <= 21; i++) {
        const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i);
        if (c.agenda.diasDaSemana.includes(d.getDay())) disponibilidade[chaveDia(d)] = { inicio: c.agenda.inicio, fim: c.agenda.fim };
      }
      const diarista = {
        id: dep.ids.novo(), nome: nomePublico(c.nome), iniciais: iniciaisDe(c.nome),
        anosExperiencia: Number(c.anosExperiencia) || 0, regioes: [...c.regioes], tarefas: [...c.tarefas],
        naoFaz: c.naoFaz, precos: { ...c.precos }, disponibilidade,
        verificacao: { data: `${MESES[agora.getMonth()]}/${agora.getFullYear()}`,
          resultado: 'Documento com foto, certidões de antecedentes da Polícia Civil do DF e da Polícia Federal e duas referências confirmadas por telefone.' },
        avaliacoes: [],
      };
      await dep.diaristas.criar(diarista);
      let acesso = null;
      if (c.email && dep.perfis && !(await dep.perfis.porEmail(c.email))) {
        acesso = novoPerfil({ email: c.email, papel: 'diarista', diaristaId: diarista.id });
        await dep.perfis.salvar(acesso);
      }
      const aprovada = { ...c, status: STATUS_CANDIDATURA.APROVADA, diaristaId: diarista.id };
      await dep.candidaturas.salvar(aprovada);
      await dep.notificador.enviar({ para: c.celular, canal: 'whatsapp', texto: 'Seu cadastro no DiaCerto foi aprovado.' });
      return { candidatura: aprovada, diarista, acesso };
    },

    async reprovarCandidatura(id, motivo) {
      const c = await carregar(id);
      exigirAberta(c);
      if (String(motivo ?? '').trim().length < 5) throw new RegraDeNegocioViolada('MOTIVO', 'Registre o motivo (uso interno).');
      const nova = { ...c, status: STATUS_CANDIDATURA.REPROVADA, motivoReprovacao: String(motivo).trim().slice(0, 300) };
      await dep.candidaturas.salvar(nova);
      return nova;
    },
  };
}
