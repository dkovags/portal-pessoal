import { html } from '../html.js';
import { erro } from '../componentes.js';
import { moeda, dataCurta, horario } from '../formatos.js';
import { TIPOS_OCORRENCIA, GRAVIDADES, ABERTO_POR, PAPEIS, REGIOES_PILOTO } from '../../dominio/index.js';

const ABAS = [['cadastros', 'Cadastros'], ['atendimentos', 'Atendimentos'], ['ocorrencias', 'Ocorrências'], ['indicadores', 'Indicadores'], ['acessos', 'Acessos']];
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
  const conteudo = await { cadastros: abaCadastros, atendimentos: abaAtendimentos, ocorrencias: abaOcorrencias, indicadores: abaIndicadores, acessos: abaAcessos }[aba](ctx, rota);
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

async function abaAcessos(ctx) {
  const dados = await ctx.casos.listarAcessos();
  const e = ctx.estado('acessos', { erro: '', ok: '', cliente: { nome: '', endereco: '', regiao: REGIOES_PILOTO[0], email: '' }, vinculo: { email: '', diaristaId: '' }, outro: { email: '', papel: 'cliente', clienteId: '' } });
  const opcao = (v, r, atual) => html`<option value="${v}" ${v === atual ? html`selected` : ''}>${r}</option>`;
  return {
    html: html`
      ${e.ok ? html`<p class="ok" role="status">${e.ok}</p>` : ''}${erro(e.erro)}
      <section class="pilha">
        <h2 class="subtitulo">Quem tem acesso</h2>
        ${dados.perfis.map((p) => html`
          <div class="cartao entre">
            <div class="pilha-curta"><strong class="pequeno">${p.email}</strong>
              <span class="mudo mini">${PAPEIS[p.papel]}${p.nome ? ` · ${p.nome}` : ''}</span></div>
            <button type="button" class="chip" data-remover="${p.email}" aria-label="Remover acesso de ${p.email}">Remover</button>
          </div>`)}
      </section>

      <form class="cartao pilha-curta" data-cliente>
        <h2 class="subtitulo">Cadastrar cliente</h2>
        <label>Nome<input name="nome" value="${e.cliente.nome}" required></label>
        <label>Endereço (quadra, bloco, apartamento)<input name="endereco" value="${e.cliente.endereco}" required></label>
        <label>Região<select name="regiao">${REGIOES_PILOTO.map((r) => opcao(r, r, e.cliente.regiao))}</select></label>
        <label>E-mail da conta Google (para entrar no DiaCerto)<input name="email" type="email" value="${e.cliente.email}" placeholder="opcional"></label>
        <button class="btn">Cadastrar cliente</button>
      </form>

      <form class="cartao pilha-curta" data-vinculo>
        <h2 class="subtitulo">Dar acesso a uma diarista</h2>
        ${dados.diaristasSemAcesso.length ? html`
          <label>Profissional<select name="diaristaId">${dados.diaristasSemAcesso.map((d) => opcao(d.id, d.nome, e.vinculo.diaristaId))}</select></label>
          <label>E-mail da conta Google dela<input name="email" type="email" value="${e.vinculo.email}" required></label>
          <button class="btn">Dar acesso</button>`
          : html`<p class="mudo pequeno">Todas as profissionais aprovadas já têm acesso. Novas profissionais entram pelo cadastro assistido.</p>`}
      </form>

      <form class="cartao pilha-curta" data-outro>
        <h2 class="subtitulo">Outros acessos</h2>
        <label>Papel<select name="papel">${['cliente', 'operacao'].map((k) => opcao(k, PAPEIS[k], e.outro.papel))}</select></label>
        ${e.outro.papel === 'cliente' ? html`<label>Cliente já cadastrado
          <select name="clienteId">${dados.clientesSemAcesso.map((c) => opcao(c.id, `${c.nome} (${c.regiao})`, e.outro.clienteId))}</select></label>` : ''}
        <label>E-mail da conta Google<input name="email" type="email" value="${e.outro.email}" required></label>
        <span class="mudo mini">Operação vê e altera tudo, inclusive os acessos. Dê esse papel só a sócios e a quem atende.</span>
        <button class="btn contorno">Dar acesso</button>
      </form>`,
    ligar(raiz) {
      const agir = async (fn, ok) => { e.erro = ''; e.ok = ''; try { await fn(); e.ok = ok; } catch (falha) { e.erro = falha.message; } ctx.redesenhar(); };
      const dadosDe = (form) => Object.fromEntries(new FormData(form));
      raiz.querySelector('[data-cliente]').addEventListener('submit', (ev) => {
        ev.preventDefault(); e.cliente = dadosDe(ev.currentTarget);
        agir(async () => { await ctx.casos.cadastrarCliente({ ...e.cliente, email: e.cliente.email || null }); e.cliente = { nome: '', endereco: '', regiao: REGIOES_PILOTO[0], email: '' }; }, 'Cliente cadastrado.');
      });
      raiz.querySelector('[data-vinculo]').addEventListener('submit', (ev) => {
        ev.preventDefault(); e.vinculo = dadosDe(ev.currentTarget);
        if (!e.vinculo.diaristaId) return;
        agir(async () => { await ctx.casos.concederAcesso({ email: e.vinculo.email, papel: 'diarista', diaristaId: e.vinculo.diaristaId }); e.vinculo = { email: '', diaristaId: '' }; }, 'Acesso liberado.');
      });
      const outro = raiz.querySelector('[data-outro]');
      outro.querySelector('[name=papel]').addEventListener('change', (ev) => { e.outro = { ...dadosDe(outro), papel: ev.target.value }; ctx.redesenhar(); });
      outro.addEventListener('submit', (ev) => {
        ev.preventDefault(); e.outro = dadosDe(outro);
        agir(async () => { await ctx.casos.concederAcesso({ email: e.outro.email, papel: e.outro.papel, clienteId: e.outro.clienteId || null }); e.outro = { email: '', papel: 'cliente', clienteId: '' }; }, 'Acesso liberado.');
      });
      raiz.querySelectorAll('[data-remover]').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.confirmar !== 'sim') { b.dataset.confirmar = 'sim'; b.textContent = 'Confirmar remoção'; b.classList.add('ativo'); return; }
        agir(() => ctx.casos.removerAcesso({ email: b.dataset.remover }), 'Acesso removido.');
      }));
    },
  };
}
