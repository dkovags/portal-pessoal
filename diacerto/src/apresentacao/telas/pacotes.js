import { html } from '../html.js';
import { erro } from '../componentes.js';
import { moeda } from '../formatos.js';

const dataNumerica = (d) => new Date(d).toLocaleDateString('pt-BR');
const DURACAO = { diaria: 'diárias', meiaDiaria: 'meias diárias' };

/** #/pacotes: saldo, validade, encerramento com reembolso e desistência (RF11). */
export async function telaPacotes(ctx) {
  const lista = await ctx.casos.meusPacotes({ clienteId: ctx.sessao.clienteId });
  const e = ctx.estado('pacotes', { confirmar: null, erro: '', ok: '' });

  const cartao = (p) => {
    const situacao = p.status === 'encerrado'
      ? html`<span class="etiqueta neutra">Encerrado em ${dataNumerica(p.encerradoEm)}</span>`
      : p.vencido ? html`<span class="etiqueta neutra">Venceu em ${dataNumerica(p.validade)}</span>`
        : html`<span class="etiqueta">Válido até ${dataNumerica(p.validade)}</span>`;
    const confirmando = e.confirmar === p.id;
    return html`
      <section class="cartao pilha-curta">
        <div class="entre"><strong>${p.diaristaNome}</strong>${situacao}</div>
        <span class="mudo pequeno">${p.total} ${DURACAO[p.duracao]} · ${moeda(p.unitario.totalCliente)} cada · pago ${moeda(p.totalPago)} em ${dataNumerica(p.compradoEm)}</span>
        ${p.status === 'ativo' ? html`
          <div class="entre pequeno"><span>Saldo</span><strong>${p.saldo} de ${p.total}</strong></div>
          <span class="mudo mini">${p.realizados} ${p.realizados === 1 ? 'realizado' : 'realizados'}${p.agendados ? ` · ${p.agendados} ${p.agendados === 1 ? 'marcado' : 'marcados'}` : ''}</span>`
          : html`<span class="mudo mini">Devolvido: ${moeda(p.reembolso)}</span>`}
        ${p.disponivel ? html`<a class="btn suave-btn" href="#/reserva/${p.diaristaId}?duracao=${p.duracao}&amp;modalidade=pacote">Agendar pelo pacote</a>` : ''}
        ${p.status === 'ativo' && p.saldo > 0 && p.agendados > 0 ? html`<span class="mudo mini">Para encerrar e receber o saldo, cancele ou conclua antes os atendimentos marcados.</span>` : ''}
        ${p.podeEncerrar ? (confirmando ? html`
          <div class="cartao pilha-curta" role="alertdialog" aria-label="Confirmar encerramento">
            <strong class="pequeno tinta">${p.desistencia ? 'Desistir da compra' : 'Encerrar o pacote'}</strong>
            <span class="mudo mini">Você recebe ${moeda(p.valorReembolsavel)} de volta (${p.saldo} ${p.saldo === 1 ? 'atendimento não usado' : 'atendimentos não usados'}), na mesma forma de pagamento. O pacote deixa de valer.</span>
            <div class="grade2">
              <button type="button" class="btn contorno-neutro" data-manter>Manter</button>
              <button type="button" class="btn" data-encerrar="${p.id}">Confirmar</button>
            </div>
          </div>` : html`
          <button type="button" class="btn contorno" data-previa="${p.id}">${p.desistencia
            ? `Desistir e receber ${moeda(p.valorReembolsavel)}`
            : p.vencido ? `Receber o saldo de ${moeda(p.valorReembolsavel)}` : `Encerrar e receber ${moeda(p.valorReembolsavel)}`}</button>`) : ''}
        ${p.desistencia && !confirmando ? html`<span class="mudo mini">Você está no prazo de desistência: até 7 dias da compra, sem atendimento realizado, o valor volta inteiro.</span>` : ''}
      </section>`;
  };

  return {
    html: html`
      <header class="topo entre"><h1 class="titulo">Meus pacotes</h1><a class="link-forte" href="#/minhas">Minhas diaristas</a></header>
      ${e.ok ? html`<p class="ok" role="status">${e.ok}</p>` : ''}${erro(e.erro)}
      ${lista.length === 0 ? html`<p class="cartao mudo">Você ainda não tem pacotes. No perfil de cada profissional dá para comprar um pacote com desconto.</p>` : ''}
      <div class="pilha">${lista.map(cartao)}</div>
      <a class="btn contorno" href="#/busca">Encontrar profissional</a>`,
    ligar(raiz) {
      const agir = async (fn) => { e.erro = ''; e.ok = ''; try { await fn(); } catch (falha) { e.erro = falha.message; } ctx.redesenhar(); };
      raiz.querySelectorAll('[data-previa]').forEach((b) => b.addEventListener('click', () => { e.confirmar = b.dataset.previa; e.ok = ''; e.erro = ''; ctx.redesenhar(); }));
      raiz.querySelector('[data-manter]')?.addEventListener('click', () => { e.confirmar = null; ctx.redesenhar(); });
      raiz.querySelector('[data-encerrar]')?.addEventListener('click', (ev) => agir(async () => {
        const r = await ctx.casos.encerrarPacote({ pacoteId: ev.currentTarget.dataset.encerrar, clienteId: ctx.sessao.clienteId });
        e.confirmar = null;
        e.ok = `${r.desistencia ? 'Compra desfeita' : 'Pacote encerrado'}. ${moeda(r.reembolso)} voltam para você.`;
      }));
    },
  };
}
