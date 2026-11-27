import { html } from '../html.js';
import { erro } from '../componentes.js';
import { moeda, lerReais } from '../formatos.js';

// Campos editáveis (RF7), na ordem da tela: [campo, rótulo no formulário, tipo, nome no histórico].
export const CAMPOS_PARAMETROS = [
  { grupo: 'Comissão do DiaCerto (sobre o serviço)', campos: [
    ['comissao.avulso', 'No avulso (%)', 'percentual', 'Comissão no avulso'],
    ['comissao.pacote', 'No pacote (%)', 'percentual', 'Comissão no pacote']] },
  { grupo: 'Taxa paga pelo cliente', campos: [
    ['taxaCliente.avulso', 'No avulso (R$)', 'reais', 'Taxa do cliente no avulso'],
    ['taxaCliente.pacote', 'No pacote, por atendimento (R$)', 'reais', 'Taxa do cliente no pacote']] },
  { grupo: 'Remuneração mínima da profissional', campos: [
    ['piso.diaria', 'Diária (R$)', 'reais', 'Mínimo da diária'],
    ['piso.meiaDiaria', 'Meia diária (R$)', 'reais', 'Mínimo da meia diária']] },
  { grupo: 'Cancelamento pelo cliente', campos: [
    ['cancelamento.horasGratuitas', 'Sem custo até (horas antes)', 'horas', 'Cancelamento sem custo até'],
    ['cancelamento.percentualDevidoDiarista', 'Depois disso, fica com a profissional (% do valor dela)', 'percentual', 'Parte da profissional no cancelamento fora do prazo']] },
  { grupo: 'Pacote', campos: [
    ['pacote.quantidade', 'Atendimentos por pacote', 'numero', 'Atendimentos por pacote'],
    ['pacote.descontoMaximo', 'Desconto máximo (%)', 'percentual', 'Desconto máximo do pacote'],
    ['pacote.validadeMeses', 'Validade (meses)', 'meses', 'Validade do pacote']] },
];
const TODOS = CAMPOS_PARAMETROS.flatMap((g) => g.campos);
const ROTULOS = Object.fromEntries(TODOS.map(([c, , tipo, rotulo]) => [c, { rotulo, tipo }]));

const ler = (valores, campo) => campo.split('.').reduce((o, k) => o?.[k], valores);
const noCampo = (v, tipo) => (tipo === 'percentual' ? String(Math.round(v * 1000) / 10).replace('.', ',') : tipo === 'reais' ? (v / 100).toFixed(2).replace('.', ',') : String(v));
const doCampo = (texto, tipo) => {
  if (tipo === 'reais') return lerReais(texto);
  const n = Number(String(texto).replace(',', '.'));
  return tipo === 'percentual' ? Math.round(n * 10) / 1000 : n;
};
const pct = (v) => `${String(Math.round(v * 1000) / 10).replace('.', ',')}%`;
const SUFIXO = { horas: (v) => `${v}h antes`, meses: (v) => `${v} ${v === 1 ? 'mês' : 'meses'}` };
export const mostrarValor = (v, tipo) => (v === null || v === undefined ? '-'
  : tipo === 'percentual' ? pct(v) : tipo === 'reais' ? moeda(v) : SUFIXO[tipo] ? SUFIXO[tipo](v) : String(v));
const quando = (d) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Aba "Parâmetros" da operação: valores em vigor, nova versão com motivo e histórico. */
export async function abaParametros(ctx) {
  const [vigentes, historico] = await Promise.all([ctx.casos.parametrosVigentes(), ctx.casos.historicoParametros()]);
  const e = ctx.estado('parametros', { rascunho: null, motivo: '', previa: null, erro: '', ok: '', abaixo: [] });
  const base = e.rascunho ?? vigentes.valores;
  const atual = historico[0];

  return {
    html: html`
      ${e.ok ? html`<p class="ok" role="status">${e.ok}</p>` : ''}
      ${e.abaixo.length ? html`<p class="cartao aviso-texto">Abaixo do novo mínimo: ${e.abaixo.map((d) => d.nome).join(', ')}. Os preços atuais delas continuam valendo até que elas os atualizem; o painel delas mostra o aviso.</p>` : ''}
      <section class="cartao suave pilha-curta pequeno">
        <strong>Em vigor desde ${atual ? quando(atual.vigenteDesde) : '-'}</strong>
        ${atual ? html`<span class="mudo mini">${atual.alteradoPor} · ${atual.motivo}</span>` : ''}
        <span class="mudo mini">Uma mudança vale para reservas e pacotes novos. O que já foi contratado guarda os valores e a política de cancelamento da época.</span>
      </section>
      <form class="pilha" data-parametros novalidate>
        ${CAMPOS_PARAMETROS.map((g) => html`
          <fieldset class="cartao pilha-curta"><legend class="rotulo">${g.grupo}</legend>
            <div class="grade2">${g.campos.map(([campo, rotulo, tipo]) => html`
              <label>${rotulo}<input name="${campo}" inputmode="decimal" value="${noCampo(ler(base, campo), tipo)}"></label>`)}</div>
          </fieldset>`)}
        <p class="mudo mini">A janela de funcionamento (${vigentes.janela.inicio}h às ${vigentes.janela.fim}h) e o limite de ${vigentes.limiteSemanal} atendimentos por semana com o mesmo cliente não são editáveis aqui.</p>
        <label>Motivo da mudança (fica no histórico)<textarea name="motivo" maxlength="500" placeholder="Ex.: teste de comissão menor no avulso durante dezembro">${e.motivo}</textarea></label>
        ${e.previa ? html`
          <div class="cartao pilha-curta" role="alertdialog" aria-label="Confirmar nova versão">
            <strong class="pequeno tinta">O que muda</strong>
            ${e.previa.length ? html`<ul class="lista pequeno">${e.previa.map((m) => html`<li>${ROTULOS[m.campo].rotulo}: ${mostrarValor(m.antes, ROTULOS[m.campo].tipo)} → ${mostrarValor(m.depois, ROTULOS[m.campo].tipo)}</li>`)}</ul>`
              : html`<span class="mudo mini">Nenhum valor diferente do que está em vigor.</span>`}
            <div class="grade2">
              <button type="button" class="btn contorno-neutro" data-revisar>Revisar</button>
              <button type="button" class="btn" data-salvar ${e.previa.length ? '' : html`disabled`}>Pôr em vigor</button>
            </div>
          </div>` : html`<button class="btn">Ver o que muda</button>`}
        ${erro(e.erro)}
      </form>
      <section class="pilha">
        <h2 class="subtitulo">Histórico</h2>
        ${historico.map((v) => html`
          <div class="cartao pilha-curta">
            <div class="entre"><strong class="pequeno">${quando(v.vigenteDesde)}</strong><span class="mudo mini">${v.alteradoPor}</span></div>
            <span class="mudo mini">${v.motivo}</span>
            ${v.mudancas.length ? html`<ul class="lista mini">${v.mudancas.map((m) => html`<li>${ROTULOS[m.campo]?.rotulo ?? m.campo}: ${mostrarValor(m.antes, ROTULOS[m.campo]?.tipo)} → ${mostrarValor(m.depois, ROTULOS[m.campo]?.tipo)}</li>`)}</ul>` : html`<span class="mudo mini">Versão inicial.</span>`}
          </div>`)}
      </section>`,
    ligar(raiz) {
      const form = raiz.querySelector('[data-parametros]');
      const lerFormulario = () => {
        const f = new FormData(form);
        const valores = structuredClone(vigentes.valores);
        for (const [campo, , tipo] of TODOS) {
          const [g, c] = campo.split('.');
          valores[g][c] = doCampo(f.get(campo), tipo);
        }
        e.rascunho = valores;
        e.motivo = String(f.get('motivo') ?? '');
      };
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        lerFormulario();
        e.erro = ''; e.ok = '';
        e.previa = TODOS.map(([campo]) => ({ campo, antes: ler(vigentes.valores, campo), depois: ler(e.rascunho, campo) }))
          .filter((m) => m.antes !== m.depois);
        ctx.redesenhar();
      });
      raiz.querySelector('[data-revisar]')?.addEventListener('click', () => { lerFormulario(); e.previa = null; ctx.redesenhar(); });
      raiz.querySelector('[data-salvar]')?.addEventListener('click', async () => {
        lerFormulario();
        e.erro = '';
        try {
          // no servidor, quem altera é sempre a conta logada; na demonstração, a da operação fictícia
          const r = await ctx.casos.alterarParametros({ valores: e.rascunho, motivo: e.motivo, alteradoPor: ctx.info.email ?? 'operacao@exemplo.com' });
          Object.assign(e, { rascunho: null, motivo: '', previa: null, ok: 'Nova versão em vigor. Vale para reservas e pacotes novos.', abaixo: r.abaixoDoPiso });
        } catch (falha) { e.erro = falha.message; e.previa = null; }
        ctx.redesenhar();
      });
    },
  };
}
