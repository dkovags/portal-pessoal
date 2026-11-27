import { html } from '../html.js';
import { cabecalho } from '../componentes.js';
import { TEXTOS_LEGAIS } from '../textos-legais.js';

const dataDaVersao = (v) => v.split('-').reverse().join('/');

/** Corpo de um documento legal (também usado antes do login). */
export function documentoLegal(id) {
  const d = TEXTOS_LEGAIS[id];
  if (!d) return html`<p class="erro" role="alert">Documento não encontrado.</p>`;
  return html`
    <p class="mudo pequeno">Versão de ${dataDaVersao(d.versao)}</p>
    <p class="cartao aviso-texto">${d.aviso}</p>
    <article class="pilha documento">
      ${d.secoes.map((s) => html`<section class="pilha-curta"><h2 class="subtitulo">${s.titulo}</h2>${s.paragrafos.map((p) => html`<p class="pequeno">${p}</p>`)}</section>`)}
    </article>`;
}

/** #/termos/<documento>?voltar=<hash> */
export async function telaTermos(ctx, rota) {
  const id = rota.params[0];
  const voltar = rota.query.voltar || '#/';
  return { html: html`
    ${cabecalho(TEXTOS_LEGAIS[id]?.titulo ?? 'Documento', voltar)}
    ${documentoLegal(id)}
    <a class="btn contorno" href="${voltar}">Voltar</a>` };
}
