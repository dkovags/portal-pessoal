import { novoPerfil, novoCliente, normalizarEmail, RegraDeNegocioViolada } from '../dominio/index.js';

/**
 * Casos de uso de acesso: cadastro de clientes e de perfis (operação, cliente, diarista).
 * @param {{perfis:import('./portas.js').RepositorioPerfis, clientes:import('./portas.js').RepositorioClientes,
 *   diaristas:import('./portas.js').RepositorioDiaristas, ids:import('./portas.js').GeradorDeIds}} dep
 */
export function criarCasosDeAcesso(dep) {
  async function garantirLivre(email) {
    const atual = await dep.perfis.porEmail(email);
    if (atual) throw new RegraDeNegocioViolada('EMAIL_EM_USO', `O e-mail ${email} já tem acesso como ${atual.papel}.`);
  }
  return {
    async listarAcessos() {
      const [perfis, clientes, diaristas] = await Promise.all([dep.perfis.listar(), dep.clientes.listar(), dep.diaristas.listar()]);
      const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]));
      const nomeDiarista = new Map(diaristas.map((d) => [d.id, d.nome]));
      const comAcesso = new Set(perfis.map((p) => p.diaristaId).filter(Boolean));
      const clientesComAcesso = new Set(perfis.map((p) => p.clienteId).filter(Boolean));
      return {
        perfis: perfis.map((p) => ({ ...p, nome: p.clienteId ? nomeCliente.get(p.clienteId) : p.diaristaId ? nomeDiarista.get(p.diaristaId) : null }))
          .sort((a, b) => a.papel.localeCompare(b.papel) || a.email.localeCompare(b.email)),
        diaristasSemAcesso: diaristas.filter((d) => !comAcesso.has(d.id)).map((d) => ({ id: d.id, nome: d.nome })),
        clientesSemAcesso: clientes.filter((c) => !clientesComAcesso.has(c.id)),
      };
    },

    /** Cadastra o cliente e, se houver e-mail, já libera o acesso dele. */
    async cadastrarCliente({ nome, endereco, regiao, email }) {
      const emailOk = email ? normalizarEmail(email) : null;
      if (emailOk) await garantirLivre(emailOk);
      const cliente = novoCliente({ id: dep.ids.novo(), nome, endereco, regiao });
      await dep.clientes.criar(cliente);
      if (emailOk) await dep.perfis.salvar(novoPerfil({ email: emailOk, papel: 'cliente', clienteId: cliente.id }));
      return cliente;
    },

    async concederAcesso({ email, papel, clienteId = null, diaristaId = null }) {
      const perfil = novoPerfil({ email, papel, clienteId, diaristaId });
      await garantirLivre(perfil.email);
      if (perfil.clienteId && !(await dep.clientes.obter(perfil.clienteId))) throw new RegraDeNegocioViolada('CLIENTE', 'Cliente não encontrado.');
      if (perfil.diaristaId && !(await dep.diaristas.obter(perfil.diaristaId))) throw new RegraDeNegocioViolada('DIARISTA', 'Profissional não encontrada.');
      await dep.perfis.salvar(perfil);
      return perfil;
    },

    async removerAcesso({ email }, solicitante = null) {
      const e = normalizarEmail(email);
      const atual = await dep.perfis.porEmail(e);
      if (!atual) throw new RegraDeNegocioViolada('NAO_ENCONTRADO', 'Acesso não encontrado.');
      if (solicitante && e === solicitante) throw new RegraDeNegocioViolada('PROPRIO', 'Você não pode remover o próprio acesso.');
      if (atual.papel === 'operacao' && (await dep.perfis.listar()).filter((p) => p.papel === 'operacao').length <= 1) {
        throw new RegraDeNegocioViolada('ULTIMA_OPERACAO', 'É preciso manter ao menos uma pessoa na operação.');
      }
      await dep.perfis.remover(e);
      return { email: e };
    },
  };
}
