import { html } from './html.js';

export const icone = {
  voltar: html`<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  escudo: html`<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  cupom: html`<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12l9-9 9 9-9 9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>`,
  logo: html`<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect x="2" y="4" width="24" height="22" rx="6" fill="none" stroke="#0F5F58" stroke-width="2"/><path d="M2 11h24M9 2v5M19 2v5" stroke="#0F5F58" stroke-width="2" stroke-linecap="round"/><path d="M9.5 18l3 3 6-6" fill="none" stroke="#B45309" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

export const cabecalho = (titulo, voltar) => html`
  <header class="topo">
    ${voltar ? html`<a class="icone-btn" href="${voltar}" aria-label="Voltar">${icone.voltar}</a>` : ''}
    <h1 class="titulo">${titulo}</h1>
  </header>`;

export const avatar = (iniciais, cor = 'var(--primaria)', tamanho = 52) =>
  html`<span class="avatar" style="width:${tamanho}px;height:${tamanho}px;background:${cor}">${iniciais}</span>`;

export const CORES = { d1: '#0F5F58', d2: '#7A4E1D', d3: '#3D4A7A' };

export const erro = (mensagem) => (mensagem ? html`<p class="erro" role="alert">${mensagem}</p>` : '');

export const ajuda = (texto) => html`
  <section class="cartao ajuda">${icone.escudo}<span>${texto} <a href="#/ajuda"><strong>Pedir ajuda</strong></a></span></section>`;
