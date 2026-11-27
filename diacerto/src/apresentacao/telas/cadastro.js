import { html } from '../html.js';
import { cabecalho, erro } from '../componentes.js';
import { moeda, lerReais, percentual } from '../formatos.js';
import {
  ITENS_VERIFICACAO, TAREFAS_CATALOGO, REGIOES_PILOTO, calcularAtendimento, aplicarParametros, PARAMETROS_PADRAO,
} from '../../dominio/index.js';

const PASSOS = ['Dados', 'Serviços', 'Preços', 'Agenda', 'Verificação', 'Revisão'];
const DIAS = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom']];
const RESULTADO = { pendente: 'Pendente', ok: 'Conferido', nao_aprovado: 'Não aprovado' };
const reaisCampo = (c) => (c ? (c / 100).toFixed(2).replace('.', ',') : '');
const horas = Array.from({ length: PARAMETROS_PADRAO.janela.fim - PARAMETROS_PADRAO.janela.inicio + 1 }, (_, i) => PARAMETROS_PADRAO.janela.inicio + i);

function marcavel(nome, valor, rotulo, marcado, tipo = 'checkbox') {
  return html`<label class="marcavel"><input type="${tipo}" name="${nome}" value="${valor}" ${marcado ? html`checked` : ''}><span>${rotulo}</span></label>`;
}

export async function telaCadastro(ctx, rota) {
  const id = rota.params[1];
  const c = await ctx.casos.obterCandidatura(id);
  const passo = Math.min(Math.max(Number(rota.query.passo) || (c.status === 'contato' ? 1 : 6), 1), 6);
  const e = ctx.estado('cadastro-' + id, { erro: '', aprovada: null, motivo: '' });
  const encerrada = c.status === 'aprovada' || c.status === 'reprovada';
  const ir = (p) => `#/operacao/cadastro/${id}?passo=${p}`;

  if (encerrada) {
    return { html: html`
      ${cabecalho(c.nome, '#/operacao')}
      ${c.status === 'aprovada'
        ? html`<section class="cartao pilha-curta"><strong>Cadastro aprovado</strong>
            <span class="mudo pequeno">O perfil já aparece para os clientes nas regiões ${c.regioes.join(', ')}.</span>
            <span class="mudo pequeno">${c.email ? `Acesso de diarista liberado para ${c.email}.` : 'Sem e-mail informado: libere o acesso dela em Operação, Acessos.'}</span>
            <a class="btn suave-btn" href="#/profissional/${c.diaristaId}">Ver o perfil publicado</a></section>`
        : html`<section class="cartao pilha-curta"><strong>Cadastro não aprovado</strong>
            <span class="mudo pequeno">Motivo registrado (uso interno): ${c.motivoReprovacao}</span></section>`}
      <a class="btn contorno" href="#/operacao">Voltar à operação</a>` };
  }

  // simulação com as regras comerciais em vigor (comissão, taxa, piso)
  const parametros = passo === 3 ? aplicarParametros(PARAMETROS_PADRAO, (await ctx.casos.parametrosVigentes()).valores) : PARAMETROS_PADRAO;
  const sim = c.precos.diaria ? {
    avulso: calcularAtendimento({ servico: c.precos.diaria, transporte: c.precos.transporte, modalidade: 'avulso' }, parametros),
    pacote: calcularAtendimento({ servico: c.precos.diaria, transporte: c.precos.transporte, modalidade: 'pacote', descontoPacote: c.precos.descontoPacote }, parametros),
  } : null;

  const corpo = {
    1: () => html`
      <label>Nome completo<input name="nome" value="${c.nome}" required></label>
      <label>WhatsApp com DDD<input name="celular" inputmode="tel" value="${c.celular}" required></label>
      <label>E-mail da conta Google (para ela entrar no DiaCerto)<input name="email" type="email" value="${c.email ?? ''}" placeholder="opcional"></label>
      <label>Anos de experiência<input name="anosExperiencia" inputmode="numeric" value="${c.anosExperiencia}"></label>
      <fieldset class="pilha-curta"><legend class="rotulo">Regiões onde atende</legend>
        <div class="chips">${REGIOES_PILOTO.map((r) => marcavel('regioes', r, r, c.regioes.includes(r)))}</div></fieldset>
      <p class="mudo mini">No perfil aparece só o primeiro nome e a inicial do sobrenome. O celular não é mostrado aos clientes.</p>`,
    2: () => html`
      <fieldset class="pilha-curta"><legend class="rotulo">Tarefas que faz</legend>
        <div class="chips">${TAREFAS_CATALOGO.map((t) => marcavel('tarefas', t, t, c.tarefas.includes(t)))}</div></fieldset>
      <label>O que não faz<textarea name="naoFaz" maxlength="200" placeholder="Ex.: áreas em altura, limpeza pós-obra">${c.naoFaz}</textarea></label>
      <p class="mudo mini">A profissional escolhe o próprio escopo. A lista é só um ponto de partida.</p>`,
    3: () => html`
      <div class="grade2">
        <label>Diária de 8 horas (R$)<input name="diaria" inputmode="decimal" value="${reaisCampo(c.precos.diaria)}"></label>
        <label>Meia diária de 4 horas (R$)<input name="meiaDiaria" inputmode="decimal" value="${reaisCampo(c.precos.meiaDiaria)}"></label>
        <label>Transporte (R$)<input name="transporte" inputmode="decimal" value="${reaisCampo(c.precos.transporte)}"></label>
        <label>Desconto no pacote (%)<input name="descontoPacote" inputmode="numeric" value="${Math.round(c.precos.descontoPacote * 100)}"></label>
      </div>
      <p class="mudo mini">Mínimo: diária ${moeda(parametros.piso.diaria)} e meia diária ${moeda(parametros.piso.meiaDiaria)}. Desconto do pacote até ${percentual(parametros.pacote.descontoMaximo)}. Comissão do DiaCerto: ${percentual(parametros.comissao.avulso)} no avulso e ${percentual(parametros.comissao.pacote)} no pacote.</p>
      ${sim ? html`<div class="cartao suave pilha-curta pequeno">
        <div class="entre"><span>Recebe na diária avulsa</span><strong>${moeda(sim.avulso.recebeDiarista)}</strong></div>
        <div class="entre"><span>Recebe na diária do pacote</span><strong>${moeda(sim.pacote.recebeDiarista)}</strong></div>
        <div class="entre"><span>O cliente paga no avulso</span><strong>${moeda(sim.avulso.totalCliente)}</strong></div>
      </div>` : ''}`,
    4: () => html`
      <fieldset class="pilha-curta"><legend class="rotulo">Dias de trabalho</legend>
        <div class="chips">${DIAS.map(([n, r]) => marcavel('dias', n, r, c.agenda.diasDaSemana.includes(n)))}</div></fieldset>
      <div class="grade2">
        <label>A partir de<select name="inicio">${horas.map((h) => html`<option value="${h}" ${h === c.agenda.inicio ? html`selected` : ''}>${h}h</option>`)}</select></label>
        <label>Até<select name="fim">${horas.map((h) => html`<option value="${h}" ${h === c.agenda.fim ? html`selected` : ''}>${h}h</option>`)}</select></label>
      </div>
      <p class="mudo mini">É só a agenda inicial das próximas 3 semanas. Depois a própria profissional abre e fecha dias pelo próprio painel.</p>`,
    5: () => html`
      <p class="cartao aviso-texto">Confira os documentos e as certidões na hora e registre só o resultado. Não guarde fotos ou cópias no sistema.</p>
      ${ITENS_VERIFICACAO.map((i) => html`
        <fieldset class="cartao pilha-curta"><legend class="rotulo">${i.rotulo}</legend>
          <div class="chips">${Object.entries(RESULTADO).map(([v, r]) => marcavel(i.id, v, r, (c.verificacao[i.id]?.resultado ?? 'pendente') === v, 'radio'))}</div>
          ${c.verificacao[i.id]?.data ? html`<span class="mudo mini">Registrado em ${c.verificacao[i.id].data.split('-').reverse().join('/')}</span>` : ''}
        </fieldset>`)}`,
    6: () => html`
      <section class="cartao pilha-curta">
        <h2 class="subtitulo">Código de conduta</h2>
        <ul class="lista mudo pequeno">
          <li>Define preço, dias e horários, e pode recusar pedidos sem perder avaliação.</li>
          <li>Pode pedir ajuda ao DiaCerto a qualquer momento, sem avisar o cliente.</li>
          <li>Não faz tarefas fora do combinado nem atividades em altura.</li>
          <li>Respeita a privacidade e os bens da casa do cliente.</li>
        </ul>
        ${c.aceiteConduta
          ? html`<span class="destaque pequeno">Aceite registrado em ${new Date(c.aceiteConduta).toLocaleString('pt-BR')}.</span>`
          : html`<button type="button" class="btn suave-btn" data-aceite>Leu e aceitou: registrar aceite</button>`}
      </section>
      <section class="cartao pilha-curta">
        <h2 class="subtitulo">${c.pendencias.length ? 'O que falta para aprovar' : 'Tudo pronto para aprovar'}</h2>
        ${c.pendencias.length ? html`<ul class="lista pequeno">${c.pendencias.map((p) => html`<li>${p}</li>`)}</ul>`
          : html`<p class="mudo pequeno">Ao aprovar, o perfil de ${c.nome.split(' ')[0]} passa a aparecer para os clientes.</p>`}
      </section>
      <button type="button" class="btn" data-aprovar ${c.pendencias.length ? html`disabled` : ''}>Aprovar cadastro</button>
      <details class="cartao"><summary class="pequeno"><strong>Não aprovar</strong></summary>
        <div class="pilha-curta" style="margin-top:10px">
          <label>Motivo (uso interno, não é enviado à profissional)<textarea data-motivo maxlength="300">${e.motivo}</textarea></label>
          <button type="button" class="btn contorno-neutro" data-reprovar>Registrar que não foi aprovada</button>
        </div></details>`,
  };

  return {
    html: html`
      ${cabecalho(c.nome, '#/operacao')}
      <nav class="passos-nav" aria-label="Etapas do cadastro">
        ${PASSOS.map((r, i) => html`<a href="${ir(i + 1)}" class="${i + 1 === passo ? html`ativo` : ''}" ${i + 1 === passo ? html`aria-current="step"` : ''}>${i + 1}. ${r}</a>`)}
      </nav>
      <form class="pilha" data-passo>
        ${corpo[passo]()}
        ${erro(e.erro)}
        ${passo < 6 ? html`<div class="grade2">
          ${passo > 1 ? html`<a class="btn contorno-neutro" href="${ir(passo - 1)}">Voltar</a>` : html`<span></span>`}
          <button class="btn">Salvar e continuar</button></div>` : ''}
      </form>`,
    ligar(raiz) {
      const agir = async (fn, proximo) => {
        e.erro = '';
        try { await fn(); if (proximo) return ctx.ir(proximo); } catch (falha) { e.erro = falha.message; }
        ctx.redesenhar();
      };
      const form = raiz.querySelector('[data-passo]');
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = new FormData(form);
        const alteracoes = {
          1: () => ({ nome: f.get('nome'), email: String(f.get('email') ?? '').trim() || null, celular: String(f.get('celular')).replace(/\D/g, ''), anosExperiencia: Number(f.get('anosExperiencia')) || 0, regioes: f.getAll('regioes') }),
          2: () => ({ tarefas: f.getAll('tarefas'), naoFaz: String(f.get('naoFaz')).trim() }),
          3: () => ({ precos: { diaria: lerReais(f.get('diaria')) || 0, meiaDiaria: lerReais(f.get('meiaDiaria')) || 0, transporte: lerReais(f.get('transporte')) || 0, descontoPacote: (Number(f.get('descontoPacote')) || 0) / 100 } }),
          4: () => ({ agenda: { diasDaSemana: f.getAll('dias').map(Number), inicio: Number(f.get('inicio')), fim: Number(f.get('fim')) } }),
          5: () => ({ verificacao: Object.fromEntries(ITENS_VERIFICACAO.map((i) => [i.id, f.get(i.id) ?? 'pendente'])) }),
        }[passo];
        if (alteracoes) agir(() => ctx.casos.atualizarCandidatura(id, alteracoes()), ir(passo + 1));
      });
      raiz.querySelector('[data-aceite]')?.addEventListener('click', () => agir(() => ctx.casos.registrarAceiteDaConduta(id)));
      raiz.querySelector('[data-aprovar]')?.addEventListener('click', () => agir(() => ctx.casos.aprovarCandidatura(id)));
      raiz.querySelector('[data-motivo]')?.addEventListener('input', (ev) => { e.motivo = ev.target.value; });
      raiz.querySelector('[data-reprovar]')?.addEventListener('click', () => agir(() => ctx.casos.reprovarCandidatura(id, e.motivo)));
    },
  };
}
