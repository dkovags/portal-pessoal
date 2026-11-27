import { html } from '../html.js';
import { cabecalho, avatar, CORES } from '../componentes.js';
import { moeda, nota, dataCurta } from '../formatos.js';
import { chaveDia } from '../../aplicacao/datas.js';

const REGIOES = ['Asa Norte', 'Asa Sul', 'Noroeste', 'Sudoeste', 'Lago Norte'];
const DURACOES = [['todas', 'Todas'], ['meiaDiaria', '4 horas'], ['diaria', '8 horas']];

export async function telaBusca(ctx, rota) {
  const q = rota.query;
  const regiao = q.regiao ?? 'Asa Norte';
  const duracao = q.duracao ?? 'todas';
  const data = q.data ?? '';
  const lista = await ctx.casos.buscarProfissionais({ regiao, data: data || undefined, duracao });
  const hoje = ctx.agora();
  const dias = Array.from({ length: 14 }, (_, i) => { const d = new Date(hoje); d.setDate(d.getDate() + i + 1); return chaveDia(d); });
  const montar = (mudanca) => '#/busca?' + new URLSearchParams({ regiao, duracao, data, ...mudanca }).toString();

  return {
    html: html`
      ${cabecalho('Encontrar profissional', '#/')}
      <form class="grade2" data-filtros>
        <label>Data
          <select name="data"><option value="">Qualquer dia</option>
            ${dias.map((d) => html`<option value="${d}" ${d === data ? html`selected` : ''}>${dataCurta(d)}</option>`)}
          </select></label>
        <label>Região
          <select name="regiao">${REGIOES.map((r) => html`<option ${r === regiao ? html`selected` : ''}>${r}</option>`)}</select></label>
      </form>
      <nav class="chips" aria-label="Duração">
        ${DURACOES.map(([id, rotulo]) => html`<a class="chip ${id === duracao ? html`ativo` : ''}" href="${montar({ duracao: id })}">${rotulo}</a>`)}
      </nav>
      <p class="mudo pequeno">${lista.length} ${lista.length === 1 ? 'profissional disponível' : 'profissionais disponíveis'}. Preço total por atendimento, já com transporte e taxa.</p>
      <section class="pilha">
        ${lista.length === 0 ? html`<p class="cartao mudo">Ninguém disponível com esses filtros. Tente outro dia ou região.</p>` : ''}
        ${lista.map((p) => html`
          <a class="cartao perfil-card" href="#/profissional/${p.id}?${new URLSearchParams({ duracao: p.duracao, data }).toString()}">
            <div class="linha">
              ${avatar(p.iniciais, CORES[p.id])}
              <div class="cresce">
                <strong>${p.nome}</strong>
                <span class="mudo pequeno">${nota(p.nota)} · ${p.atendimentos} atendimentos · ${p.anosExperiencia} anos</span>
              </div>
              <div class="direita"><strong class="preco">${moeda(p.totalAvulso)}</strong><span class="mudo mini">${p.horas} horas</span></div>
            </div>
            <div class="chips">${p.verificada ? html`<span class="etiqueta">Identidade e antecedentes verificados</span>` : ''}</div>
            <span class="mudo pequeno">${p.tarefas.join(', ')}</span>
          </a>`)}
      </section>`,
    ligar(raiz) {
      raiz.querySelector('[data-filtros]').addEventListener('change', (e) => {
        const f = new FormData(e.currentTarget);
        ctx.ir(montar({ data: f.get('data'), regiao: f.get('regiao') }));
      });
    },
  };
}
