// Quem pode chamar cada caso de uso, e com quais dados. O servidor nunca confia no
// cliente/diarista informado pelo navegador: troca pelo do perfil de quem está logado.
import { RegraDeNegocioViolada, aceitesPendentes } from '../../dominio/index.js';

export class SemPermissao extends Error { constructor(m = 'Você não tem permissão para esta ação.') { super(m); this.name = 'SemPermissao'; } }

const publico = new Set(['solicitarContato', 'parametrosVigentes']);

// quem entrou com Google mas ainda não tem acesso só pode se cadastrar como cliente, com o próprio e-mail
const SEM_PERFIL = {
  autocadastrarCliente: ([p = {}], email) => [{ ...p, email }],
};

// o aceite é sempre de quem está logado, no papel que tem
const aceitarComoEuMesmo = ([p = {}], perfil) => [{ aceites: p.aceites, email: perfil.email, papel: perfil.papel }];

// ações que criam obrigação exigem os termos vigentes aceitos (a tela pede antes; o servidor confere)
const EXIGEM_ACEITE = new Set(['solicitarReserva', 'comprarPacote', 'remarcarAtendimento', 'responderPedido']);
async function exigirAceites(perfil, dep) {
  if (!dep.aceites) return;
  const faltam = aceitesPendentes(perfil.papel, await dep.aceites.listar(perfil.email));
  if (faltam.length) throw new SemPermissao(`Antes de continuar, leia e aceite: ${faltam.map((d) => d.titulo).join(' e ')}.`);
}

const doAtendimento = async (dep, atendimentoId, campo, id) => {
  const a = await dep.atendimentos.obter(atendimentoId);
  if (!a || a[campo] !== id) throw new SemPermissao();
};

/** Regras por papel: recebem os argumentos e devolvem os argumentos que serão usados. */
const REGRAS = {
  cliente: {
    buscarProfissionais: (args) => args,
    obterPerfil: (args) => args,
    simularReserva: ([p = {}], perfil) => [{ ...p, clienteId: perfil.clienteId }],
    solicitarReserva: ([p = {}], perfil) => [{ ...p, clienteId: perfil.clienteId }],
    cancelarPeloCliente: ([p = {}], perfil) => [{ ...p, clienteId: perfil.clienteId }],
    simularCancelamento: ([p = {}], perfil) => [{ ...p, clienteId: perfil.clienteId }],
    remarcarAtendimento: ([p = {}], perfil) => [{ ...p, clienteId: perfil.clienteId }],
    meusAtendimentos: (_, perfil) => [{ clienteId: perfil.clienteId }],
    pendentesDeAvaliacao: (_, perfil) => [{ clienteId: perfil.clienteId }],
    avaliarProfissional: ([p = {}], perfil) => [{ ...p, clienteId: perfil.clienteId }],
    minhasDiaristas: (_, perfil) => [perfil.clienteId],
    comprarPacote: ([p = {}], perfil) => [{ ...p, clienteId: perfil.clienteId }],
    meusDados: (_, perfil) => [{ clienteId: perfil.clienteId }],
    atualizarInstrucoesDeAcesso: ([p = {}], perfil) => [{ ...p, clienteId: perfil.clienteId }],
    conclusoesParaConfirmar: (_, perfil) => [{ clienteId: perfil.clienteId }],
    confirmarConclusao: ([p = {}], perfil) => [{ ...p, clienteId: perfil.clienteId }],
    contestarConclusao: ([p = {}], perfil) => [{ ...p, clienteId: perfil.clienteId }],
    meusPacotes: (_, perfil) => [{ clienteId: perfil.clienteId }],
    encerrarPacote: ([p = {}], perfil) => [{ ...p, clienteId: perfil.clienteId }],
    registrarAceites: aceitarComoEuMesmo,
    registrarOcorrencia: async ([p = {}], perfil, dep) => {
      await doAtendimento(dep, p.atendimentoId, 'clienteId', perfil.clienteId);
      return [{ ...p, abertoPor: 'cliente' }];
    },
  },
  diarista: {
    painelDiarista: (_, perfil) => [perfil.diaristaId],
    meusAtendimentos: (_, perfil) => [{ diaristaId: perfil.diaristaId }],
    pendentesDeAvaliacao: (_, perfil) => [{ diaristaId: perfil.diaristaId }],
    avaliarCliente: ([p = {}], perfil) => [{ ...p, diaristaId: perfil.diaristaId }],
    responderPedido: ([p = {}], perfil) => [{ ...p, diaristaId: perfil.diaristaId }],
    confirmarChegada: async ([p = {}], perfil, dep) => { await doAtendimento(dep, p.atendimentoId, 'diaristaId', perfil.diaristaId); return [p]; },
    concluirAtendimento: async ([p = {}], perfil, dep) => { await doAtendimento(dep, p.atendimentoId, 'diaristaId', perfil.diaristaId); return [p]; },
    atualizarPrecos: ([, precos], perfil) => [perfil.diaristaId, precos],
    atualizarPreferencias: ([, prefs], perfil) => [perfil.diaristaId, prefs],
    definirDisponibilidade: ([, data, janela], perfil) => [perfil.diaristaId, data, janela],
    obterPerfil: (args) => args,
    registrarAceites: aceitarComoEuMesmo,
    registrarOcorrencia: async ([p = {}], perfil, dep) => {
      await doAtendimento(dep, p.atendimentoId, 'diaristaId', perfil.diaristaId);
      return [{ ...p, abertoPor: 'diarista' }];
    },
  },
};

/**
 * @param {string} nome caso de uso @param {any[]} args
 * @param {{email:string, papel:string, clienteId?:string, diaristaId?:string}|null} perfil
 * @param {any} dep @param {string|null} [email] e-mail de quem está logado (mesmo sem perfil)
 */
export async function autorizar(nome, args, perfil, dep, email = null) {
  if (!Array.isArray(args)) throw new RegraDeNegocioViolada('ARGUMENTOS', 'Argumentos inválidos.');
  if (publico.has(nome)) return args;
  if (!perfil) {
    if (email && SEM_PERFIL[nome]) return SEM_PERFIL[nome](args, email);
    throw new SemPermissao(email ? 'Sua conta ainda não tem acesso. Faça o seu cadastro primeiro.' : 'Entre com a sua conta para continuar.');
  }
  if (perfil.papel === 'operacao') {
    // operação: acesso completo (inclui a demonstração dos perfis), mas o que fica registrado
    // em nome de alguém é sempre de quem está logado
    if (nome === 'removerAcesso') return [args[0], perfil.email];
    if (nome === 'alterarParametros') return [{ ...(args[0] ?? {}), alteradoPor: perfil.email }];
    if (nome === 'registrarAceites') return aceitarComoEuMesmo(args, perfil);
    if (nome === 'autocadastrarCliente') return SEM_PERFIL.autocadastrarCliente(args, perfil.email);
    return args;
  }
  const regra = REGRAS[perfil.papel]?.[nome];
  if (!regra) throw new SemPermissao();
  if (EXIGEM_ACEITE.has(nome)) await exigirAceites(perfil, dep);
  return regra(args, perfil, dep);
}
