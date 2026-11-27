import { html } from '../html.js';
import { erro } from '../componentes.js';
import { moeda, dataCurta, horario } from '../formatos.js';
import { TIPOS_OCORRENCIA, GRAVIDADES, ABERTO_POR } from '../../dominio/index.js';

const ABAS = [['cadastros', 'Cadastros'], ['atendimentos', 'Atendimentos'], ['ocorrencias', 'Ocorrências'], ['indicadores', 'Indicadores']];
const STATUS_AT = { solicitado: 'Aguardando aceite', aceito: 'Confirmado', em_andamento: 'Em andamento', concluido: 'Concluído', recusado: 'Recusado', cancelado: 'Cancelado' };
const FAIXA = { verde: 'Seguir', amarelo: 'Ajustar', vermelho: 'Parar ou mudar', sem_dados: 'Sem dados ainda' };

const ROTULO = { contato: 'Pediu contato', em_cadastro: 'Em cadastro', aprovada: 'Aprovada', reprovada: 'Reprovada' };
const celularFormatado = (c) => (c.length === 11 ? `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}` : `(${c.slice(0, 2)}) ${c.slice(2, 6)}-${c.slice(6)}`);

async function abaCadastros(ctx) {
  const lista = await ctx.casos.listarCandidaturas();
  const e = ctx.estado('operacao', { nome: '', celular: '', erro: '' });
  return {
    html: html`
      <section class="pilha">
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

async function abaAtendimentos(ctx, rota) {
  const status = rota.query.status ?? 'todos';
  const lista = await ctx.casos.listarAtendimentosOperacao({ status });
  const filtros = [['todos', 'Todos'], ...Object.entries(STATUS_AT)];
  return { html: html`
    <nav class="chips" aria-label="Situação">${filtros.map(([k, r]) => html`<a class="chip ${k === status ? html`ativo` : ''}" href="#/operacao/atendimentos?status=${k}">${r}</a>`)}</nav>
    <section class="pilha">
      ${lista.length === 0 ? html`<p class="cartao mudo">Nenhum atendimento nessa situação.</p>` : ''}
      ${lista.map((a) => html`
        <a class="cartao pilha-curta" href="#/operacao/atendimento/${a.id}">
          <div class="entre"><strong class="pequeno">${dataCurta(a.inicio)} · ${horario(a.horaInicio, a.horaFim)}</strong><span class="etiqueta ${['cancelado', 'recusado'].includes(a.status) ? html`neutra` : ''}">${STATUS_AT[a.status]}</span></div>
          <span class="mudo pequeno">${a.clienteNome} com ${a.diaristaNome} · ${a.modalidade === 'pacote' ? 'pacote' : 'avulso'} · ${moeda(a.valores.totalCliente)}</span>
          ${a.ocorrencias ? html`<span class="mini desconto">${a.ocorrencias} ${a.ocorrencias === 1 ? 'ocorrência' : 'ocorrências'}</span>` : ''}
        </a>`)}
    </section>` };
}

async function abaOcorrencias(ctx, rota) {
  const status = rota.query.status ?? 'aberta';
  const lista = await ctx.casos.listarOcorrencias({ status });
  return { html: html`
    <nav class="chips" aria-label="Situação">${[['aberta', 'Abertas'], ['resolvida', 'Resolvidas'], ['todas', 'Todas']].map(([k, r]) => html`<a class="chip ${k === status ? html`ativo` : ''}" href="#/operacao/ocorrencias?status=${k}">${r}</a>`)}</nav>
    <section class="pilha">
      ${lista.length === 0 ? html`<p class="cartao mudo">Nenhuma ocorrência ${status === 'aberta' ? 'aberta' : 'aqui'}.</p>` : ''}
      ${lista.map((o) => html`
        <a class="cartao pilha-curta ${o.status === 'aberta' && o.gravidade === 'grave' ? html`alerta` : ''}" href="#/operacao/atendimento/${o.atendimentoId}">
          <div class="entre"><strong class="pequeno">${TIPOS_OCORRENCIA[o.tipo]} · ${GRAVIDADES[o.gravidade]}</strong>
            <span class="etiqueta ${o.status === 'resolvida' ? html`neutra` : ''}">${o.status === 'aberta' ? `Aberta há ${o.horasAberta}h` : 'Resolvida'}</span></div>
          <span class="mudo pequeno">${o.descricao}</span>
          ${o.atendimento ? html`<span class="mudo mini">${o.atendimento.clienteNome} com ${o.atendimento.diaristaNome}, ${dataCurta(o.atendimento.inicio)} · relatado por ${ABERTO_POR[o.abertoPor].toLowerCase()}</span>` : ''}
          ${o.reembolso ? html`<span class="mini desconto">Reembolso de ${moeda(o.reembolso)}</span>` : ''}
        </a>`)}
    </section>` };
}

function valorIndicador(i) {
  if (i.valor === null) return '–';
  if (i.formato === 'percentual') return `${Math.round(i.valor * 100)}%`;
  if (i.formato === 'reais') return moeda(i.valor);
  return String(i.valor);
}

async function abaIndicadores(ctx) {
  const r = await ctx.casos.indicadoresDoPiloto();
  return { html: html`
    <section class="grade2">
      <div class="cartao pilha-curta"><span class="mudo mini">Atendimentos concluídos no mês</span><strong class="preco">${r.mes.atendimentos}</strong></div>
      <div class="cartao pilha-curta"><span class="mudo mini">Receita da plataforma no mês</span><strong class="preco">${moeda(r.mes.receita)}</strong></div>
      <div class="cartao pilha-curta"><span class="mudo mini">Transacionado no mês</span><strong class="preco">${moeda(r.mes.transacionado)}</strong></div>
      <div class="cartao pilha-curta"><span class="mudo mini">Reembolsos no mês</span><strong class="preco">${moeda(r.mes.reembolsos)}</strong></div>
    </section>
    <h2 class="subtitulo">Critérios de interrupção</h2>
    <section class="pilha">
      ${r.indicadores.map((i) => html`
        <div class="cartao pilha-curta indicador ${i.faixa}">
          <div class="entre"><strong class="pequeno">${i.rotulo}</strong><strong class="preco">${valorIndicador(i)}</strong></div>
          <span class="semaforo ${i.faixa}">${FAIXA[i.faixa]}</span>
          <span class="mudo mini">${i.regra}</span>
        </div>`)}
    </section>
    <p class="mudo mini">Faixas e custos variáveis são as hipóteses do documento do piloto, em src/dominio/parametros.js. Com poucos atendimentos, os números ainda dizem pouco.</p>` };
}

export async function telaOperacao(ctx, rota) {
  const aba = ABAS.some(([k]) => k === rota.params[0]) ? rota.params[0] : 'cadastros';
  const conteudo = await { cadastros: abaCadastros, atendimentos: abaAtendimentos, ocorrencias: abaOcorrencias, indicadores: abaIndicadores }[aba](ctx, rota);
  return {
    html: html`
      <header class="topo entre"><h1 class="titulo">Operação</h1><a class="link-forte" href="#/">Início</a></header>
      <nav class="abas" aria-label="Seções da operação">
        ${ABAS.map(([k, r]) => html`<a href="#/operacao/${k}" class="${k === aba ? html`ativa` : ''}" ${k === aba ? html`aria-current="page"` : ''}>${r}</a>`)}
      </nav>
      ${conteudo.html}`,
    ligar: conteudo.ligar,
  };
}
