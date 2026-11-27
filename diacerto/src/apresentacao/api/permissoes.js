// Quem pode chamar cada caso de uso, e com quais dados. O servidor nunca confia no
// cliente/diarista informado pelo navegador: troca pelo do perfil de quem está logado.
import { RegraDeNegocioViolada } from '../../dominio/index.js';

export class SemPermissao extends Error { constructor(m = 'Você não tem permissão para esta ação.') { super(m); this.name = 'SemPermissao'; } }

const publico = new Set(['solicitarContato']);

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
    minhasDiaristas: (_, perfil) => [perfil.clienteId],
    registrarOcorrencia: async ([p = {}], perfil, dep) => {
      await doAtendimento(dep, p.atendimentoId, 'clienteId', perfil.clienteId);
      return [{ ...p, abertoPor: 'cliente' }];
    },
  },
  diarista: {
    painelDiarista: (_, perfil) => [perfil.diaristaId],
    responderPedido: ([p = {}], perfil) => [{ ...p, diaristaId: perfil.diaristaId }],
    confirmarChegada: async ([p = {}], perfil, dep) => { await doAtendimento(dep, p.atendimentoId, 'diaristaId', perfil.diaristaId); return [p]; },
    concluirAtendimento: async ([p = {}], perfil, dep) => { await doAtendimento(dep, p.atendimentoId, 'diaristaId', perfil.diaristaId); return [p]; },
    atualizarPrecos: ([, precos], perfil) => [perfil.diaristaId, precos],
    definirDisponibilidade: ([, data, janela], perfil) => [perfil.diaristaId, data, janela],
    obterPerfil: (args) => args,
    registrarOcorrencia: async ([p = {}], perfil, dep) => {
      await doAtendimento(dep, p.atendimentoId, 'diaristaId', perfil.diaristaId);
      return [{ ...p, abertoPor: 'diarista' }];
    },
  },
};

/**
 * @param {string} nome caso de uso @param {any[]} args @param {{papel:string, clienteId?:string, diaristaId?:string}|null} perfil
 */
export async function autorizar(nome, args, perfil, dep) {
  if (!Array.isArray(args)) throw new RegraDeNegocioViolada('ARGUMENTOS', 'Argumentos inválidos.');
  if (publico.has(nome)) return args;
  if (!perfil) throw new SemPermissao('Entre com a sua conta para continuar.');
  if (perfil.papel === 'operacao') {
    // operação: acesso completo (inclui a demonstração dos perfis); quem remove acesso é sempre quem está logado
    return nome === 'removerAcesso' ? [args[0], perfil.email] : args;
  }
  const regra = REGRAS[perfil.papel]?.[nome];
  if (!regra) throw new SemPermissao();
  return regra(args, perfil, dep);
}
