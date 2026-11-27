import { html } from '../html.js';
import { avatar, CORES, icone } from '../componentes.js';
import { dataLonga, dataCurta, horario, moeda, quando } from '../formatos.js';
import { TIPOS_OCORRENCIA, LIMITE_INSTRUCOES } from '../../dominio/index.js';

const MOTIVOS_CONTESTACAO = ['qualidade', 'dano', 'atraso', 'seguranca', 'outro'];
import { erro, formAvaliacao, ligarAvaliacoes } from '../componentes.js';

export async function telaMinhas(ctx) {
  const lista = await ctx.casos.minhasDiaristas(ctx.sessao.clienteId);
  const e = ctx.estado('minhas', { cancelar: null, previa: null, erro: '', ok: '', notaBaixa: null, contestar: null });
  const pendentes = await ctx.casos.pendentesDeAvaliacao({ clienteId: ctx.sessao.clienteId });
  const confirmar = await ctx.casos.conclusoesParaConfirmar({ clienteId: ctx.sessao.clienteId });
  const proximo = lista.map((x) => x.proximo && { ...x.proximo, nome: x.diarista.nome, pacote: x.pacote }).filter(Boolean)
    .sort((a, b) => a.inicio - b.inicio)[0];
  return { html: html`
    <header class="topo entre"><h1 class="titulo">Minhas diaristas</h1><span class="linha"><a class="link-forte" href="#/pacotes">Pacotes</a><a class="link-forte" href="#/">Início</a></span></header>
    ${confirmar.map((c) => html`
      <section class="cartao pilha-curta borda-forte" aria-label="Confirmar atendimento">
        <strong>${c.com} marcou o atendimento de ${dataCurta(c.inicio)} como concluído</strong>
        <span class="mudo pequeno">Está tudo certo? Confirme ou conte o que aconteceu até ${quando(c.liberarEm)}. Sem resposta, o pagamento dela é liberado.</span>
        ${e.contestar === c.id ? html`
          <form class="pilha-curta" data-contestar="${c.id}">
            <label>O que aconteceu<select name="tipo">${MOTIVOS_CONTESTACAO.map((t) => html`<option value="${t}">${TIPOS_OCORRENCIA[t]}</option>`)}</select></label>
            <label>Conte com detalhes<textarea name="descricao" maxlength="1000" required></textarea></label>
            <span class="mudo mini">O pagamento da profissional fica em análise até a operação ouvir vocês dois.</span>
            <div class="grade2"><button type="button" class="btn contorno-neutro" data-voltar-contestacao>Voltar</button><button class="btn">Enviar</button></div>
          </form>` : html`
          <div class="grade2">
            <button type="button" class="btn contorno-neutro" data-abrir-contestacao="${c.id}">Algo deu errado</button>
            <button type="button" class="btn" data-confirmar-conclusao="${c.id}">Está tudo certo</button>
          </div>`}
      </section>`)}
    ${proximo ? html`
      <section class="cartao escuro pilha-curta">
        <span class="mini claro">Próximo atendimento · ${proximo.status === 'solicitado' ? 'aguardando aceite' : 'confirmado'}</span>
        <strong>${proximo.nome} · ${dataLonga(proximo.inicio)}</strong>
        <span class="pequeno claro">${horario(proximo.horaInicio, proximo.horaFim)}${proximo.pacoteId ? ' · pelo pacote' : ''}</span>
        <span class="pequeno claro">Código de confirmação: <strong>${proximo.codigoConfirmacao}</strong></span>
        ${proximo.local ? html`
          <span class="pequeno claro">${proximo.local.endereco}${proximo.local.instrucoes ? ` · Acesso: ${proximo.local.instrucoes}` : ''}</span>
          ${proximo.instrucoesEditaveis ? html`<details class="pilha-curta"><summary class="mini claro">${proximo.local.instrucoes ? 'Mudar as instruções de acesso' : 'Incluir instruções de acesso'}</summary>
            <form class="pilha-curta" data-instrucoes="${proximo.id}">
              <textarea name="instrucoes" maxlength="${LIMITE_INSTRUCOES}" placeholder="Ex.: a chave fica na portaria.">${proximo.local.instrucoes}</textarea>
              <span class="mini claro">Só a profissional que aceitou vê, e só até o fim do dia do atendimento.</span>
              <button class="btn claro-btn">Salvar instruções</button>
            </form></details>` : ''}` : ''}
        ${e.cancelar === proximo.id && e.previa ? html`
          <div class="cartao pilha-curta" role="alertdialog" aria-label="Confirmar cancelamento">
            <strong class="pequeno tinta">${e.previa.gratuito ? 'Cancelamento sem custo' : 'Cancelamento fora do prazo gratuito'}</strong>
            <span class="mudo mini">${e.previa.voltaAoPacote
              ? 'O atendimento volta para o saldo do seu pacote.'
              : e.previa.gratuito
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
          ${x.pacote ? html`<a class="etiqueta" href="#/pacotes">Pacote: ${x.pacote.saldo} de ${x.pacote.total} disponíveis</a>` : ''}
          <span class="mudo pequeno">${x.proximosLivres.length ? html`Próximos horários livres: ${x.proximosLivres.map((h) => `${dataCurta(h.data)} (${horario(h.inicio, h.fim)})`).join('; ')}` : 'Sem horários livres no momento. Você recebe um aviso quando ela abrir a agenda.'}</span>
          ${x.proximosLivres.length
            ? html`<a class="btn suave-btn" href="${x.pacote ? `#/reserva/${x.diarista.id}?duracao=${x.pacote.duracao}&modalidade=pacote` : `#/reserva/${x.diarista.id}`}">Agendar com ${x.diarista.nome.split(' ')[0]}${x.pacote ? ' pelo pacote' : ''}</a>`
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
    raiz.querySelectorAll('[data-confirmar-conclusao]').forEach((b) => b.addEventListener('click', () => agir(async () => {
      await ctx.casos.confirmarConclusao({ atendimentoId: b.dataset.confirmarConclusao, clienteId: ctx.sessao.clienteId });
      e.ok = 'Obrigado! O pagamento da profissional foi liberado.';
    })));
    raiz.querySelectorAll('[data-abrir-contestacao]').forEach((b) => b.addEventListener('click', () => { e.contestar = b.dataset.abrirContestacao; ctx.redesenhar(); }));
    raiz.querySelector('[data-voltar-contestacao]')?.addEventListener('click', () => { e.contestar = null; ctx.redesenhar(); });
    raiz.querySelector('[data-contestar]')?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.currentTarget);
      const atendimentoId = ev.currentTarget.dataset.contestar;
      agir(async () => {
        await ctx.casos.contestarConclusao({ atendimentoId, clienteId: ctx.sessao.clienteId, tipo: String(f.get('tipo')), descricao: String(f.get('descricao') ?? '') });
        e.contestar = null;
        e.ok = 'Recebemos o seu relato. A operação vai ouvir as duas partes e responder pelo WhatsApp.';
      });
    });
    raiz.querySelector('[data-instrucoes]')?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const atendimentoId = ev.currentTarget.dataset.instrucoes;
      const instrucoes = String(new FormData(ev.currentTarget).get('instrucoes') ?? '');
      agir(async () => { await ctx.casos.atualizarInstrucoesDeAcesso({ atendimentoId, clienteId: ctx.sessao.clienteId, instrucoes }); e.ok = 'Instruções de acesso salvas.'; });
    });
    raiz.querySelector('[data-confirmar-cancelamento]')?.addEventListener('click', (ev) => agir(async () => {
      await ctx.casos.cancelarPeloCliente({ atendimentoId: ev.currentTarget.dataset.confirmarCancelamento, clienteId: ctx.sessao.clienteId });
      e.cancelar = null; e.previa = null; e.ok = 'Reserva cancelada.';
    }));
  } };
}
