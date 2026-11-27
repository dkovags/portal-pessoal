import { html } from '../html.js';
import { avatar, CORES, icone } from '../componentes.js';
import { dataLonga, dataCurta, horario, moeda } from '../formatos.js';
import { erro, formAvaliacao, ligarAvaliacoes } from '../componentes.js';

export async function telaMinhas(ctx) {
  const lista = await ctx.casos.minhasDiaristas(ctx.sessao.clienteId);
  const e = ctx.estado('minhas', { cancelar: null, previa: null, erro: '', ok: '', notaBaixa: null });
  const pendentes = await ctx.casos.pendentesDeAvaliacao({ clienteId: ctx.sessao.clienteId });
  const proximo = lista.map((x) => x.proximo && { ...x.proximo, nome: x.diarista.nome, pacote: x.pacote }).filter(Boolean)
    .sort((a, b) => a.inicio - b.inicio)[0];
  return { html: html`
    <header class="topo entre"><h1 class="titulo">Minhas diaristas</h1><a class="link-forte" href="#/">Início</a></header>
    ${proximo ? html`
      <section class="cartao escuro pilha-curta">
        <span class="mini claro">Próximo atendimento · ${proximo.status === 'solicitado' ? 'aguardando aceite' : 'confirmado'}</span>
        <strong>${proximo.nome} · ${dataLonga(proximo.inicio)}</strong>
        <span class="pequeno claro">${horario(proximo.horaInicio, proximo.horaFim)}${proximo.pacote ? html` · Pacote: ${proximo.pacote.total - proximo.pacote.usados} de ${proximo.pacote.total} restantes` : ''}</span>
        <span class="pequeno claro">Código de confirmação: <strong>${proximo.codigoConfirmacao}</strong></span>
        ${e.cancelar === proximo.id && e.previa ? html`
          <div class="cartao pilha-curta" role="alertdialog" aria-label="Confirmar cancelamento">
            <strong class="pequeno tinta">${e.previa.gratuito ? 'Cancelamento sem custo' : 'Cancelamento com menos de 24 horas'}</strong>
            <span class="mudo mini">${e.previa.gratuito
              ? `Você recebe de volta ${moeda(e.previa.reembolsoCliente)}.`
              : `Você recebe de volta ${moeda(e.previa.reembolsoCliente)}. ${moeda(e.previa.devidoDiarista)} ficam com a profissional, que reservou o dia.`}</span>
            <div class="grade2">
              <button type="button" class="btn contorno-neutro" data-manter>Manter</button>
              <button type="button" class="btn" data-confirmar-cancelamento="${proximo.id}">Cancelar</button>
            </div>
          </div>` : html`
          <div class="grade2">
            <a class="btn claro-btn" href="#/remarcar/${proximo.id}?diarista=${proximo.diaristaId}&amp;duracao=${proximo.duracao}">Remarcar</a>
            <button type="button" class="btn claro-btn" data-cancelar="${proximo.id}">Cancelar</button>
          </div>`}
        <a class="link-claro centro-texto" href="#/ajuda?de=cliente&amp;atendimento=${proximo.id}">Falar com o suporte</a>
      </section>` : ''}
    ${e.ok ? html`<p class="ok" role="status">${e.ok}</p>` : ''}${erro(e.erro)}
    ${e.notaBaixa ? html`<p class="cartao aviso-texto">Sentimos muito. Se algo deu errado, <a href="#/ajuda?de=cliente&amp;atendimento=${e.notaBaixa}">conte para a operação</a>: ouvimos as duas partes e, em caso de dano, há reembolso.</p>` : ''}
    ${pendentes.length ? html`<section class="pilha">
      <h2 class="subtitulo">Como foi?</h2>
      ${formAvaliacao(pendentes[0], `${pendentes[0].com} · ${dataCurta(pendentes[0].inicio)}`, 'Sua avaliação aparece no perfil da profissional, sem o seu nome.')}
      ${pendentes.length > 1 ? html`<details class="pilha-curta"><summary class="pequeno link-forte">Mais ${pendentes.length - 1} ${pendentes.length === 2 ? 'atendimento' : 'atendimentos'} para avaliar</summary>
        <div class="pilha" style="margin-top:10px">${pendentes.slice(1).map((p) => formAvaliacao(p, `${p.com} · ${dataCurta(p.inicio)}`, 'Sua avaliação aparece no perfil da profissional, sem o seu nome.'))}</div></details>` : ''}
    </section>` : ''}
    <section class="pilha">
      <h2 class="subtitulo">Agendar de novo</h2>
      ${lista.length === 0 ? html`<p class="cartao mudo">Depois do primeiro atendimento, sua profissional aparece aqui.</p>` : ''}
      ${lista.map((x) => html`
        <div class="cartao pilha-curta">
          <div class="linha">${avatar(x.diarista.iniciais, CORES[x.diarista.id], 48)}
            <div class="cresce"><strong>${x.diarista.nome}</strong>
              <span class="mudo pequeno bloco">${x.vezes === 0 ? 'Primeiro atendimento solicitado' : html`${x.vezes} ${x.vezes === 1 ? 'atendimento' : 'atendimentos'} com você`}${x.ultima ? html` · última vez em ${dataCurta(x.ultima)}` : ''}</span></div></div>
          ${x.pacote ? html`<span class="etiqueta">Pacote: ${x.pacote.total - x.pacote.usados} atendimentos restantes</span>` : ''}
          <span class="mudo pequeno">${x.proximosLivres.length ? html`Próximos horários livres: ${x.proximosLivres.map((h) => `${dataCurta(h.data)} (${horario(h.inicio, h.fim)})`).join('; ')}` : 'Sem horários livres no momento. Você recebe um aviso quando ela abrir a agenda.'}</span>
          ${x.proximosLivres.length
            ? html`<a class="btn suave-btn" href="#/reserva/${x.diarista.id}">Agendar com ${x.diarista.nome.split(' ')[0]}</a>`
            : html`<a class="btn contorno" href="#/busca">Ver outras profissionais</a>`}
        </div>`)}
    </section>
    <section class="cartao aviso">${icone.cupom}<p><strong>Indique o DiaCerto.</strong> Quem você indicar ganha R$ 30 no primeiro atendimento, e você ganha R$ 30 no próximo.</p></section>
  `,
  ligar(raiz) {
    const agir = async (fn) => { e.erro = ''; e.ok = ''; try { await fn(); } catch (falha) { e.erro = falha.message; } ctx.redesenhar(); };
    raiz.querySelector('[data-cancelar]')?.addEventListener('click', (ev) => agir(async () => {
      e.cancelar = ev.currentTarget.dataset.cancelar;
      e.previa = await ctx.casos.simularCancelamento({ atendimentoId: e.cancelar, clienteId: ctx.sessao.clienteId });
    }));
    ligarAvaliacoes(raiz, (p) => agir(async () => {
      await ctx.casos.avaliarProfissional({ ...p, clienteId: ctx.sessao.clienteId });
      e.ok = 'Obrigado pela avaliação.'; e.notaBaixa = p.nota <= 2 ? p.atendimentoId : null;
    }));
    raiz.querySelector('[data-manter]')?.addEventListener('click', () => { e.cancelar = null; e.previa = null; ctx.redesenhar(); });
    raiz.querySelector('[data-confirmar-cancelamento]')?.addEventListener('click', (ev) => agir(async () => {
      await ctx.casos.cancelarPeloCliente({ atendimentoId: ev.currentTarget.dataset.confirmarCancelamento, clienteId: ctx.sessao.clienteId });
      e.cancelar = null; e.previa = null; e.ok = 'Reserva cancelada.';
    }));
  } };
}
