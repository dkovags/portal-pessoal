import { html } from '../html.js';
import { ajuda, erro, formAvaliacao, ligarAvaliacoes } from '../componentes.js';
import { moeda, dataCurta, dataLonga, horario, percentual, lerReais, quando, descreverImovel } from '../formatos.js';
import { chaveDia } from '../../aplicacao/datas.js';

const ABAS = [['pedidos', 'Pedidos'], ['agenda', 'Agenda'], ['recebimentos', 'Ganhos'], ['precos', 'Preços']];

export async function telaDiarista(ctx, rota) {
  const aba = rota.params[0] ?? 'pedidos';
  const id = ctx.sessao.diaristaId;
  const painel = await ctx.casos.painelDiarista(id);
  const e = ctx.estado('diarista', { codigos: {}, erro: '', okPrecos: '', okAvaliacao: '', okPreferencias: '' });
  const pendentesAval = aba === 'pedidos' ? await ctx.casos.pendentesDeAvaliacao({ diaristaId: id }) : [];
  const primeiro = painel.diarista.nome.split(' ')[0];
  const abaixoDoPiso = painel.diarista.precos.diaria < painel.piso.diaria || painel.diarista.precos.meiaDiaria < painel.piso.meiaDiaria;
  // RF01: o local vem do servidor só depois do aceite e até o fim do dia do atendimento
  const local = (a) => (a.local
    ? html`<div class="cartao suave pilha-curta pequeno"><strong>${a.local.endereco}</strong>${a.local.instrucoes ? html`<span>Acesso: ${a.local.instrucoes}</span>` : ''}
        <span class="mudo mini">Visível até o fim do dia do atendimento.</span></div>`
    : html`<span class="mudo mini">Endereço indisponível. Fale com o suporte.</span>`);

  const conteudo = {
    pedidos: () => html`
      ${painel.pendentes.length === 0 ? html`<p class="cartao mudo">Nenhum pedido novo. Você recebe um aviso no WhatsApp quando chegar.</p>` : ''}
      ${painel.pendentes.map((a) => html`
        <section class="pilha-curta">
          <div class="cartao escuro pilha-curta">
            <span class="mini claro">Novo pedido · você recebe</span>
            <strong class="valor-grande">${moeda(a.valores.recebeDiarista)}</strong>
            <span class="pequeno claro">Serviço ${moeda(a.valores.recebeDiarista - a.valores.transporte)} + transporte ${moeda(a.valores.transporte)}. Você recebe depois do atendimento concluído.</span>
          </div>
          <div class="cartao pilha-curta pequeno">
            <div class="entre"><span class="mudo">Quando</span><strong>${dataCurta(a.inicio)} · ${horario(a.horaInicio, a.horaFim)}</strong></div>
            <div class="entre"><span class="mudo">Cliente</span><strong>${a.clienteNome}</strong></div>
            <div class="entre"><span class="mudo">Região</span><strong>${a.clienteRegiao || '-'}</strong></div>
            <div class="entre"><span class="mudo">Modalidade</span><strong>${a.modalidade === 'pacote' ? 'Pacote' : 'Avulso'}</strong></div>
            ${a.imovel ? html`<div class="entre"><span class="mudo">Imóvel</span><strong class="direita">${descreverImovel(a.imovel)}</strong></div>` : ''}
            ${a.tarefas?.length ? html`<div class="pilha-curta"><span class="mudo">Tarefas pedidas</span><div class="chips">${a.tarefas.map((t) => html`<span class="etiqueta neutra">${t}</span>`)}</div></div>` : ''}
            <div class="entre"><span class="mudo">Produtos</span><strong>${a.materiais === 'profissional' ? 'Você leva os produtos' : 'Do cliente'}</strong></div>
            ${a.observacoes ? html`<span class="mudo">Recado: "${a.observacoes}"</span>` : ''}
            <span class="mudo mini">O endereço e as instruções de acesso aparecem depois que você aceitar.</span>
          </div>
          <div class="grade2">
            <button type="button" class="btn contorno-neutro" data-responder="${a.id}" data-aceitar="nao">Não posso</button>
            <button type="button" class="btn" data-responder="${a.id}" data-aceitar="sim">Aceitar</button>
          </div>
          <p class="mudo mini centro-texto">Recusar não afeta sua avaliação.</p>
        </section>`)}
      ${painel.emAndamento.length ? html`<h2 class="subtitulo">Em andamento</h2>` : ''}
      ${painel.emAndamento.map((a) => html`
        <div class="cartao pilha-curta">
          <strong>${dataLonga(a.inicio)} · ${horario(a.horaInicio, a.horaFim)}</strong>
          <span class="mudo pequeno">${a.clienteNome} · ${(a.tarefas ?? []).join(', ') || 'tarefas combinadas'}</span>
          ${local(a)}
          <button type="button" class="btn" data-concluir="${a.id}">Terminei o atendimento</button>
          <span class="mudo mini">O cliente tem ${painel.horasParaContestar} horas para confirmar ou contar se algo deu errado. Sem contestação, o seu pagamento é liberado.</span>
        </div>`)}
      ${painel.agendados.length ? html`<h2 class="subtitulo">Atendimentos confirmados</h2>` : ''}
      ${painel.agendados.map((a) => html`
        <div class="cartao pilha-curta">
          <strong>${dataLonga(a.inicio)} · ${horario(a.horaInicio, a.horaFim)}</strong>
          <span class="mudo pequeno">${a.clienteNome} · você recebe ${moeda(a.valores.recebeDiarista)}</span>
          ${a.tarefas?.length ? html`<span class="mudo mini">${a.tarefas.join(', ')}${a.materiais === 'profissional' ? ' · você leva os produtos' : ''}</span>` : ''}
          ${local(a)}
          <div class="linha"><label class="cresce">Código da cliente<input inputmode="numeric" maxlength="4" data-codigo="${a.id}" value="${e.codigos[a.id] ?? ''}"></label>
            <button type="button" class="btn pequeno-btn" data-chegada="${a.id}">Confirmar chegada</button></div>
          <span class="mudo mini">O código só libera o pagamento. Não mede horário. Não conseguiu? <a href="#/ajuda?de=diarista&amp;atendimento=${a.id}">Avise o suporte</a>.</span>
        </div>`)}
      ${e.okAvaliacao ? html`<p class="ok" role="status">${e.okAvaliacao}</p>` : ''}
      ${pendentesAval.length ? html`<h2 class="subtitulo">Avalie os clientes</h2>
        ${formAvaliacao(pendentesAval[0], `${pendentesAval[0].com} · ${dataCurta(pendentesAval[0].inicio)}`, 'Só a operação vê. Ex.: deixou os produtos, tratou bem, imóvel maior que o informado.')}
        ${pendentesAval.length > 1 ? html`<details class="pilha-curta"><summary class="pequeno link-forte">Mais ${pendentesAval.length - 1} para avaliar</summary>
          <div class="pilha" style="margin-top:10px">${pendentesAval.slice(1).map((p) => formAvaliacao(p, `${p.com} · ${dataCurta(p.inicio)}`, 'Só a operação vê.'))}</div></details>` : ''}` : ''}
      ${erro(e.erro)}`,

    agenda: () => {
      const hoje = ctx.agora();
      const dias = Array.from({ length: 14 }, (_, i) => { const d = new Date(hoje); d.setDate(d.getDate() + i + 1); return chaveDia(d); });
      const ocupados = new Set([...painel.pendentes, ...painel.agendados, ...painel.emAndamento].map((a) => chaveDia(a.inicio)));
      return html`
        <p class="mudo pequeno">Você escolhe os dias e horários. O DiaCerto funciona das ${painel.janela.inicio}h às ${painel.janela.fim}h.</p>
        ${dias.map((d) => {
          const j = painel.diarista.disponibilidade[d];
          const ocupado = ocupados.has(d);
          return html`<div class="cartao entre">
            <div class="pilha-curta"><strong class="pequeno">${dataLonga(d)}</strong>
              <span class="mudo mini">${ocupado ? 'Pedido ou atendimento neste dia' : (j ? `Livre, ${horario(j.inicio, j.fim)}` : 'Fechado')}</span></div>
            <button type="button" class="chip ${j || ocupado ? html`ativo` : ''}" data-dia="${d}" ${ocupado ? html`disabled` : ''} aria-pressed="${Boolean(j)}">${ocupado ? 'Reservado' : (j ? 'Livre' : 'Fechado')}</button>
          </div>`;
        })}`;
    },

    recebimentos: () => html`
      <div class="cartao escuro pilha-curta">
        <span class="mini claro">Recebido este mês</span>
        <strong class="valor-grande">${moeda(painel.recebidoNoMes)}</strong>
        <span class="pequeno claro">${painel.atendimentosNoMes} ${painel.atendimentosNoMes === 1 ? 'repasse liberado' : 'repasses liberados'} no mês</span>
      </div>
      ${painel.aLiberar.length ? html`<h2 class="subtitulo">A liberar</h2>
        ${painel.aLiberar.map((a) => html`<div class="cartao entre pequeno"><span>${dataCurta(a.inicio)} · ${a.clienteNome}<span class="mudo mini bloco">Libera ${quando(a.repasse.liberarEm)}, se o cliente não contestar</span></span><strong>${moeda(a.valores.recebeDiarista)}</strong></div>`)}` : ''}
      ${painel.emAnalise.length ? html`<h2 class="subtitulo">Em análise</h2>
        ${painel.emAnalise.map((a) => html`<div class="cartao entre pequeno"><span>${dataCurta(a.inicio)} · ${a.clienteNome}<span class="mudo mini bloco">O cliente relatou um problema. A operação ouve você antes de decidir.</span></span><strong>${moeda(a.valores.recebeDiarista)}</strong></div>`)}` : ''}
      ${painel.ultimosRecebimentos.length ? html`<h2 class="subtitulo">Últimos repasses</h2>` : ''}
      ${painel.ultimosRecebimentos.map((a) => html`<div class="cartao entre pequeno"><span>${dataCurta(a.inicio)} · ${a.clienteNome}${a.modalidade === 'pacote' ? ' (pacote)' : ''}</span><strong>${moeda(a.valores.recebeDiarista)}</strong></div>`)}
      <p class="mudo mini">Avulso: o DiaCerto fica com ${percentual(painel.comissao.avulso)} do serviço. Pacote: ${percentual(painel.comissao.pacote)}. O transporte é todo seu. Cada atendimento guarda os percentuais da época em que foi contratado.</p>`,

    precos: () => {
      const p = painel.diarista.precos;
      return html`
        <form class="pilha-curta" data-precos>
          <label>Diária de 8 horas<input name="diaria" inputmode="decimal" value="${(p.diaria / 100).toFixed(2).replace('.', ',')}"></label>
          <label>Meia diária de 4 horas<input name="meiaDiaria" inputmode="decimal" value="${(p.meiaDiaria / 100).toFixed(2).replace('.', ',')}"></label>
          <label>Transporte<input name="transporte" inputmode="decimal" value="${(p.transporte / 100).toFixed(2).replace('.', ',')}"></label>
          <label>Desconto no pacote de ${painel.pacote.quantidade} (%)<input name="descontoPacote" inputmode="numeric" value="${Math.round(p.descontoPacote * 100)}"></label>
          <p class="mudo mini">Com esses valores, você recebe ${moeda(painel.simulacao.avulso.recebeDiarista)} por diária avulsa e ${moeda(painel.simulacao.pacote.recebeDiarista)} por diária no pacote (desconto de ${percentual(p.descontoPacote)}). Mínimo: diária ${moeda(painel.piso.diaria)}, meia diária ${moeda(painel.piso.meiaDiaria)}. Desconto do pacote até ${percentual(painel.pacote.descontoMaximo)}.</p>
          ${erro(e.erro)}${e.okPrecos ? html`<p class="ok" role="status">${e.okPrecos}</p>` : ''}
          <button class="btn">Salvar preços</button>
        </form>
        <form class="cartao pilha-curta" data-preferencias>
          <h2 class="subtitulo">Produtos de limpeza</h2>
          <label class="aceite"><input type="checkbox" name="levaMateriais" ${painel.diarista.levaMateriais ? html`checked` : ''}><span>Posso levar os produtos de limpeza quando o cliente pedir</span></label>
          <span class="mudo mini">Os equipamentos (aspirador, rodo, balde) continuam por conta do cliente. Você vê no pedido o que ele escolheu antes de aceitar.</span>
          ${e.okPreferencias ? html`<p class="ok" role="status">${e.okPreferencias}</p>` : ''}
          <button class="btn contorno">Salvar</button>
        </form>`;
    },
  };

  return {
    html: html`
      <header class="topo entre"><h1 class="titulo">Olá, ${primeiro}</h1><a class="link-forte" href="#/">Sair</a></header>
      <nav class="abas" aria-label="Seções">
        ${ABAS.map(([k, r]) => html`<a href="#/diarista/${k}" class="${k === aba ? html`ativa` : ''}" ${k === aba ? html`aria-current="page"` : ''}>${r}${k === 'pedidos' && painel.pendentes.length ? html` <span class="contador">${painel.pendentes.length}</span>` : ''}</a>`)}
      </nav>
      ${abaixoDoPiso ? html`<p class="cartao aviso-texto">O mínimo da plataforma mudou para diária ${moeda(painel.piso.diaria)} e meia diária ${moeda(painel.piso.meiaDiaria)}. Ajuste os seus preços na aba <a href="#/diarista/precos">Preços</a>.</p>` : ''}
      <section class="pilha">${(conteudo[aba] ?? conteudo.pedidos)()}</section>
      ${ajuda('Algum problema em um atendimento? A operação ouve as duas partes.', '#/ajuda?de=diarista')}`,
    ligar(raiz) {
      const agir = async (fn) => { e.erro = ''; e.okPrecos = ''; e.okAvaliacao = ''; e.okPreferencias = ''; try { await fn(); } catch (falha) { e.erro = falha.message; } ctx.redesenhar(); };
      ligarAvaliacoes(raiz, (p) => agir(async () => { await ctx.casos.avaliarCliente({ ...p, diaristaId: id }); e.okAvaliacao = 'Avaliação enviada.'; }));
      raiz.querySelectorAll('[data-responder]').forEach((b) => b.addEventListener('click', () => agir(() =>
        ctx.casos.responderPedido({ atendimentoId: b.dataset.responder, diaristaId: id, aceitar: b.dataset.aceitar === 'sim' }))));
      raiz.querySelectorAll('[data-codigo]').forEach((i) => i.addEventListener('input', () => { e.codigos[i.dataset.codigo] = i.value; }));
      raiz.querySelectorAll('[data-chegada]').forEach((b) => b.addEventListener('click', () => agir(() =>
        ctx.casos.confirmarChegada({ atendimentoId: b.dataset.chegada, codigo: e.codigos[b.dataset.chegada] ?? '' }))));
      raiz.querySelectorAll('[data-concluir]').forEach((b) => b.addEventListener('click', () => agir(() =>
        ctx.casos.concluirAtendimento({ atendimentoId: b.dataset.concluir }))));
      raiz.querySelector('[data-preferencias]')?.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const leva = new FormData(ev.currentTarget).has('levaMateriais');
        agir(async () => { await ctx.casos.atualizarPreferencias(id, { levaMateriais: leva }); e.okPreferencias = 'Preferência salva.'; });
      });
      raiz.querySelectorAll('[data-dia]').forEach((b) => b.addEventListener('click', () => agir(() => {
        const atual = painel.diarista.disponibilidade[b.dataset.dia];
        return ctx.casos.definirDisponibilidade(id, b.dataset.dia, atual ? null : { inicio: 8, fim: 17 });
      })));
      raiz.querySelector('[data-precos]')?.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        agir(async () => {
          await ctx.casos.atualizarPrecos(id, {
            diaria: lerReais(f.get('diaria')), meiaDiaria: lerReais(f.get('meiaDiaria')),
            transporte: lerReais(f.get('transporte')), descontoPacote: Number(f.get('descontoPacote')) / 100,
          });
          e.okPrecos = 'Preços salvos.';
        });
      });
    },
  };
}
