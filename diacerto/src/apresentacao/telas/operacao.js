import { html } from '../html.js';
import { erro } from '../componentes.js';

const ROTULO = { contato: 'Pediu contato', em_cadastro: 'Em cadastro', aprovada: 'Aprovada', reprovada: 'Reprovada' };
const celularFormatado = (c) => (c.length === 11 ? `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}` : `(${c.slice(0, 2)}) ${c.slice(2, 6)}-${c.slice(6)}`);

export async function telaOperacao(ctx) {
  const lista = await ctx.casos.listarCandidaturas();
  const e = ctx.estado('operacao', { nome: '', celular: '', erro: '' });
  return {
    html: html`
      <header class="topo entre"><h1 class="titulo">Operação</h1><a class="link-forte" href="#/">Início</a></header>
      <section class="pilha">
        <h2 class="subtitulo">Cadastro de diaristas</h2>
        ${lista.length === 0 ? html`<p class="cartao mudo">Nenhuma candidatura ainda.</p>` : ''}
        ${lista.map((c) => html`
          <a class="cartao pilha-curta" href="#/operacao/cadastro/${c.id}">
            <div class="entre"><strong>${c.nome}</strong><span class="etiqueta ${c.status === 'reprovada' ? html`neutra` : ''}">${ROTULO[c.status]}</span></div>
            <span class="mudo pequeno">${celularFormatado(c.celular)} · ${c.regioes.join(', ') || 'região não informada'}</span>
            ${c.status === 'contato' || c.status === 'em_cadastro'
              ? html`<span class="mudo mini">${c.pendencias.length ? `${c.pendencias.length} ${c.pendencias.length === 1 ? 'pendência' : 'pendências'} para aprovar` : 'Pronta para aprovar'}</span>` : ''}
          </a>`)}
      </section>
      <form class="cartao pilha-curta" data-novo>
        <h2 class="subtitulo">Começar um cadastro agora</h2>
        <label>Nome completo<input name="nome" value="${e.nome}" required></label>
        <label>WhatsApp com DDD<input name="celular" inputmode="tel" value="${e.celular}" required></label>
        ${erro(e.erro)}
        <button class="btn">Iniciar cadastro assistido</button>
      </form>`,
    ligar(raiz) {
      raiz.querySelector('[data-novo]').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        Object.assign(e, { nome: f.get('nome'), celular: f.get('celular'), erro: '' });
        try {
          const c = await ctx.casos.iniciarCadastro({ nome: e.nome, celular: e.celular });
          Object.assign(e, { nome: '', celular: '' });
          return ctx.ir(`#/operacao/cadastro/${c.id}`);
        } catch (falha) { e.erro = falha.message; }
        ctx.redesenhar();
      });
    },
  };
}
