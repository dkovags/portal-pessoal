import { html } from '../html.js';
import { erro } from '../componentes.js';
import { REGIOES_PILOTO, DOCUMENTOS_LEGAIS, DOCUMENTOS_POR_PAPEL } from '../../dominio/index.js';

/**
 * Autocadastro do cliente (RF14): quem entrou com Google e ainda não tem acesso.
 * Para a operação, abre como prévia (#/boas-vindas).
 */
export async function telaBoasVindas(ctx) {
  const info = ctx.info;
  const demonstracao = info.modo === 'memoria';
  const previa = info.papel === 'operacao';
  const e = ctx.estado('boas-vindas', {
    nome: info.nome ?? '', celular: '', endereco: '', regiao: REGIOES_PILOTO[0], email: demonstracao ? 'nova.cliente@exemplo.com' : '',
    aceites: {}, erro: '', feito: null,
  });
  const documentos = DOCUMENTOS_POR_PAPEL.cliente.map((id) => ({ id, ...DOCUMENTOS_LEGAIS[id] }));

  if (e.feito) {
    return { html: html`
      <header class="topo"><h1 class="titulo">Cadastro feito</h1></header>
      <section class="cartao pilha-curta">
        <strong>Tudo certo, ${e.feito.cliente.nome.split(' ')[0]}!</strong>
        <span class="mudo pequeno">${demonstracao
          ? 'Demonstração: na versão com login, a pessoa entra direto como cliente depois deste passo.'
          : 'Agora você já pode encontrar uma profissional e fazer a sua primeira reserva.'}</span>
      </section>
      <button type="button" class="btn" data-continuar>${demonstracao ? 'Voltar à demonstração' : 'Começar'}</button>`,
    ligar(raiz) {
      raiz.querySelector('[data-continuar]').addEventListener('click', () => {
        if (demonstracao) { Object.assign(e, { feito: null, email: 'nova.cliente@exemplo.com', aceites: {} }); ctx.ir('#/'); return ctx.redesenhar(); }
        return ctx.aoCadastrar();
      });
    } };
  }

  return {
    html: html`
      <header class="topo entre"><h1 class="titulo">Bem-vindo ao DiaCerto</h1>${previa ? html`<a class="link-forte" href="#/operacao">Operação</a>` : ''}</header>
      ${previa && !demonstracao ? html`<p class="cartao aviso-texto">Prévia da tela que aparece para quem entra com Google sem ter acesso. A sua conta já tem acesso, então o envio vai avisar que o e-mail já está cadastrado.</p>` : ''}
      <p class="mudo">${info.email && !demonstracao ? html`Você entrou como <strong class="tinta">${info.email}</strong>. ` : ''}Falta pouco: conte quem você é e onde vai ser o atendimento.</p>
      <form class="pilha-curta" data-cadastro novalidate>
        ${demonstracao ? html`<label>E-mail da conta Google (demonstração)<input name="email" type="email" value="${e.email}" required></label>` : ''}
        <label>Nome<input name="nome" autocomplete="name" value="${e.nome}" required></label>
        <label>Celular com DDD<input name="celular" inputmode="tel" autocomplete="tel" placeholder="61 99999-9999" value="${e.celular}" required></label>
        <label>Endereço do atendimento<input name="endereco" autocomplete="street-address" placeholder="Quadra, bloco e apartamento" value="${e.endereco}" required></label>
        <label>Região<select name="regiao">${REGIOES_PILOTO.map((r) => html`<option ${r === e.regiao ? html`selected` : ''}>${r}</option>`)}</select></label>
        <p class="mudo mini">No piloto, o DiaCerto atende ${REGIOES_PILOTO.join(', ')}. O endereço vai para a profissional que aceitar o seu pedido.</p>
        <fieldset class="pilha-curta"><legend class="rotulo">Para continuar</legend>
          ${documentos.map((d) => html`
            <label class="aceite"><input type="checkbox" name="aceite" value="${d.id}" ${e.aceites[d.id] ? html`checked` : ''}>
              <span>Li e aceito: <a href="#/termos/${d.id}?voltar=%23%2Fboas-vindas">${d.titulo}</a></span></label>`)}
        </fieldset>
        ${erro(e.erro)}
        <button class="btn">Criar meu cadastro</button>
      </form>
      <section class="cartao suave pilha-curta">
        <strong class="pequeno">É diarista?</strong>
        <span class="mudo mini">O cadastro de profissionais é feito com a nossa equipe, com verificação de documentos e referências.</span>
        <a class="link-forte" href="#/trabalhe">Quero trabalhar com o DiaCerto</a>
      </section>
      ${info.sair ? html`<button type="button" class="btn contorno-neutro" data-sair-conta>Entrar com outra conta</button>` : ''}`,
    ligar(raiz) {
      const form = raiz.querySelector('[data-cadastro]');
      const lerFormulario = () => {
        const f = new FormData(form);
        Object.assign(e, { nome: String(f.get('nome') ?? ''), celular: String(f.get('celular') ?? ''), endereco: String(f.get('endereco') ?? ''),
          regiao: String(f.get('regiao') ?? ''), email: demonstracao ? String(f.get('email') ?? '') : e.email,
          aceites: Object.fromEntries(f.getAll('aceite').map((id) => [id, true])) });
      };
      form.addEventListener('change', lerFormulario);
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        lerFormulario();
        e.erro = '';
        try {
          e.feito = await ctx.casos.autocadastrarCliente({
            email: demonstracao ? e.email : info.email, nome: e.nome, celular: e.celular, endereco: e.endereco, regiao: e.regiao,
            aceites: Object.fromEntries(Object.keys(e.aceites).map((id) => [id, DOCUMENTOS_LEGAIS[id].versao])),
          });
        } catch (falha) { e.erro = falha.message; }
        ctx.redesenhar();
      });
      raiz.querySelector('[data-sair-conta]')?.addEventListener('click', info.sair);
    },
  };
}
