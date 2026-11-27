import { html } from '../html.js';
import { cabecalho, erro } from '../componentes.js';
import { moeda, dataLonga, horario, lerReais } from '../formatos.js';
import { TIPOS_OCORRENCIA, GRAVIDADES, ABERTO_POR, POLITICA_REEMBOLSO } from '../../dominio/index.js';

const STATUS_AT = { solicitado: 'Aguardando aceite', aceito: 'Confirmado', em_andamento: 'Em andamento', concluido: 'Concluído', recusado: 'Recusado', cancelado: 'Cancelado' };
const opcoes = (mapa, atual) => Object.entries(mapa).map(([k, r]) => html`<option value="${k}" ${k === atual ? html`selected` : ''}>${r}</option>`);

export async function telaAtendimentoOperacao(ctx, rota) {
  const id = rota.params[1];
  const a = await ctx.casos.obterAtendimentoOperacao(id);
  const e = ctx.estado('op-at-' + id, { tipo: 'dano', gravidade: 'moderada', abertoPor: 'cliente', descricao: '', erro: '', resolucao: {}, reembolso: {} });
  const v = a.valores;
  return {
    html: html`
      ${cabecalho('Atendimento', '#/operacao/atendimentos')}
      <section class="cartao pilha-curta">
        <div class="entre"><strong>${dataLonga(a.inicio)}</strong><span class="etiqueta">${STATUS_AT[a.status]}</span></div>
        <span class="mudo pequeno">${horario(a.horaInicio, a.horaFim)} · ${a.clienteNome} com ${a.diaristaNome}</span>
        <span class="mudo pequeno">${a.modalidade === 'pacote' ? 'Pacote' : 'Avulso'} · ${a.metodo === 'cartao' ? 'cartão' : 'Pix'}${a.observacoes ? ` · Recado: "${a.observacoes}"` : ''}</span>
      </section>
      <section class="cartao pilha-curta pequeno">
        <div class="entre"><span>Cliente pagou</span><strong>${moeda(v.totalCliente)}</strong></div>
        <div class="entre"><span>Profissional recebe</span><strong>${moeda(v.recebeDiarista)}</strong></div>
        <div class="entre"><span>Receita da plataforma</span><strong>${moeda(v.receitaPlataforma)}</strong></div>
        ${v.cupom ? html`<div class="entre desconto"><span>Cupom</span><span>${moeda(-v.cupom)}</span></div>` : ''}
      </section>

      <h2 class="subtitulo">Ocorrências</h2>
      ${a.ocorrencias.length === 0 ? html`<p class="mudo pequeno">Nenhuma ocorrência neste atendimento.</p>` : ''}
      ${a.ocorrencias.map((o) => html`
        <section class="cartao pilha-curta ${o.status === 'aberta' && o.gravidade === 'grave' ? html`alerta` : ''}">
          <div class="entre"><strong class="pequeno">${TIPOS_OCORRENCIA[o.tipo]} · ${GRAVIDADES[o.gravidade]}</strong><span class="etiqueta ${o.status === 'resolvida' ? html`neutra` : ''}">${o.status === 'aberta' ? 'Aberta' : 'Resolvida'}</span></div>
          <span class="mudo pequeno">${o.descricao}</span>
          <span class="mudo mini">Relatado por ${ABERTO_POR[o.abertoPor].toLowerCase()} em ${new Date(o.abertaEm).toLocaleString('pt-BR')}</span>
          ${o.status === 'resolvida'
            ? html`<span class="pequeno"><strong>Resolução:</strong> ${o.resolucao}${o.reembolso ? html` Reembolso de ${moeda(o.reembolso)}.` : ''}</span>`
            : html`<div class="pilha-curta">
                <label>Como foi resolvida (depois de ouvir as duas partes)<textarea data-resolucao="${o.id}" maxlength="1000">${e.resolucao[o.id] ?? ''}</textarea></label>
                ${['dano', 'falta_diarista'].includes(o.tipo) ? html`<label>Reembolso ao cliente (R$)
                  <input data-reembolso="${o.id}" inputmode="decimal" placeholder="0,00" value="${e.reembolso[o.id] ?? ''}"></label>
                  <span class="mudo mini">${o.tipo === 'dano' ? `Até ${moeda(POLITICA_REEMBOLSO.limiteDano)} pela Política de Reembolso.` : `Até ${moeda(v.totalCliente)}, o valor pago.`} Nada é descontado da profissional.</span>` : ''}
                <button type="button" class="btn pequeno-btn" data-resolver="${o.id}">Registrar resolução</button>
              </div>`}
        </section>`)}

      <form class="cartao pilha-curta" data-nova>
        <h2 class="subtitulo">Registrar ocorrência</h2>
        <div class="grade2">
          <label>Tipo<select name="tipo">${opcoes(TIPOS_OCORRENCIA, e.tipo)}</select></label>
          <label>Gravidade<select name="gravidade">${opcoes(GRAVIDADES, e.gravidade)}</select></label>
        </div>
        <label>Relatado por<select name="abertoPor">${opcoes(ABERTO_POR, e.abertoPor)}</select></label>
        <label>O que aconteceu<textarea name="descricao" maxlength="1000">${e.descricao}</textarea></label>
        <span class="mudo mini">Assédio, risco no local e acidentes entram sempre como graves e avisam a operação. Prazo de resposta: 72 horas.</span>
        ${erro(e.erro)}
        <button class="btn">Registrar</button>
      </form>`,
    ligar(raiz) {
      const agir = async (fn) => { e.erro = ''; try { await fn(); } catch (falha) { e.erro = falha.message; } ctx.redesenhar(); };
      raiz.querySelectorAll('[data-resolucao]').forEach((t) => t.addEventListener('input', () => { e.resolucao[t.dataset.resolucao] = t.value; }));
      raiz.querySelectorAll('[data-reembolso]').forEach((t) => t.addEventListener('input', () => { e.reembolso[t.dataset.reembolso] = t.value; }));
      raiz.querySelectorAll('[data-resolver]').forEach((b) => b.addEventListener('click', () => agir(async () => {
        const oid = b.dataset.resolver;
        const valor = e.reembolso[oid] ? lerReais(e.reembolso[oid]) : 0;
        if (Number.isNaN(valor)) throw new Error('Valor de reembolso inválido.');
        await ctx.casos.resolverOcorrencia({ ocorrenciaId: oid, resolucao: e.resolucao[oid] ?? '', reembolso: valor });
        delete e.resolucao[oid]; delete e.reembolso[oid];
      })));
      raiz.querySelector('[data-nova]').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        Object.assign(e, { tipo: f.get('tipo'), gravidade: f.get('gravidade'), abertoPor: f.get('abertoPor'), descricao: f.get('descricao') });
        agir(async () => {
          await ctx.casos.registrarOcorrencia({ atendimentoId: id, tipo: e.tipo, gravidade: e.gravidade, abertoPor: e.abertoPor, descricao: e.descricao });
          e.descricao = '';
        });
      });
    },
  };
}
