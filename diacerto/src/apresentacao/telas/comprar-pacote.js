import { html } from '../html.js';
import { cabecalho, erro } from '../componentes.js';
import { moeda, percentual } from '../formatos.js';
import { PRAZO_DESISTENCIA_DIAS } from '../../dominio/index.js';

const dataNumerica = (d) => new Date(d).toLocaleDateString('pt-BR');

/** #/pacote/<diaristaId>?duracao=diaria: compra explícita do pacote (RF11). */
export async function telaComprarPacote(ctx, rota) {
  const id = rota.params[0];
  const duracao = rota.query.duracao === 'meiaDiaria' ? 'meiaDiaria' : 'diaria';
  const p = await ctx.casos.obterPerfil(id, duracao);
  const e = ctx.estado('pacote-' + id + duracao, { metodo: 'pix', erro: '', comprado: null });
  const primeiro = p.nome.split(' ')[0];
  const agendar = `#/reserva/${id}?duracao=${duracao}&modalidade=pacote`;

  if (e.comprado) {
    const c = e.comprado;
    return { html: html`
      ${cabecalho('Pacote comprado', '#/pacotes')}
      <section class="cartao pilha-curta">
        <strong>${c.total} ${duracao === 'diaria' ? 'diárias' : 'meias diárias'} com ${p.nome}</strong>
        <span class="mudo pequeno">Pago: ${moeda(c.totalPago)} · válido até ${dataNumerica(c.validade)}</span>
        <span class="destaque pequeno">Agora é só marcar os dias. Cada atendimento sai do saldo do pacote, sem cobrança nova.</span>
      </section>
      <a class="btn" href="${agendar}">Agendar o 1º atendimento</a>
      <a class="btn contorno" href="#/pacotes">Ver meus pacotes</a>` };
  }

  const u = p.pacote;
  const total = u.totalCliente * u.quantidade;
  const economia = (p.avulso.totalCliente - u.totalCliente) * u.quantidade;
  return {
    html: html`
      ${cabecalho('Comprar pacote', `#/profissional/${id}?duracao=${duracao}`)}
      <section class="cartao pilha-curta">
        <strong>${u.quantidade} ${duracao === 'diaria' ? 'diárias de 8 horas' : 'meias diárias de 4 horas'} com ${p.nome}</strong>
        <span class="mudo pequeno">${percentual(u.desconto)} de desconto no serviço, definido pela ${primeiro}. Validade de ${u.validadeMeses} meses a partir de hoje.</span>
      </section>
      <section class="cartao pilha-curta">
        <h2 class="subtitulo">Cada atendimento</h2>
        <div class="entre"><span>Serviço com desconto</span><span>${moeda(u.servico)}</span></div>
        <div class="entre"><span>Transporte</span><span>${moeda(u.transporte)}</span></div>
        <div class="entre"><span>Taxa DiaCerto</span><span>${moeda(u.taxaCliente)}</span></div>
        <div class="entre"><strong>Por atendimento</strong><strong>${moeda(u.totalCliente)}</strong></div>
        <hr>
        <div class="entre total"><span>Total agora</span><span>${moeda(total)}</span></div>
        <p class="mudo mini">${u.quantidade} × ${moeda(u.totalCliente)}</p>
        ${economia > 0 ? html`<p class="mudo mini">Você economiza ${moeda(economia)} em relação a ${u.quantidade} atendimentos avulsos.</p>` : ''}
      </section>
      <section class="pilha-curta">
        <h2 class="subtitulo">Forma de pagamento</h2>
        <div class="grade2">
          ${[['pix', 'Pix'], ['cartao', 'Cartão de crédito']].map(([m, r]) => html`<button type="button" class="opcao centro ${e.metodo === m ? html`ativa` : ''}" data-metodo="${m}" aria-pressed="${e.metodo === m}">${r}</button>`)}
        </div>
      </section>
      <section class="cartao suave pilha-curta">
        <strong class="pequeno">Como funciona</strong>
        <ul class="lista mudo mini">
          <li>Você paga o pacote agora, e o preço de cada atendimento fica travado.</li>
          <li>Os dias são marcados um a um, conforme a agenda da ${primeiro}. Ela confirma cada pedido.</li>
          <li>Cancelamento dentro do prazo devolve o atendimento ao saldo.</li>
          <li>Você pode encerrar o pacote quando quiser e receber de volta o valor dos atendimentos não usados, inclusive depois do vencimento.</li>
          <li>Desistência: em até ${PRAZO_DESISTENCIA_DIAS} dias da compra, sem nenhum atendimento realizado, o valor volta inteiro.</li>
        </ul>
        <a class="mini link-forte" href="#/termos/termos-cliente?voltar=${encodeURIComponent(`#/pacote/${id}?duracao=${duracao}`)}">Termos de uso</a>
      </section>
      ${erro(e.erro)}
      <button type="button" class="btn fixo" data-comprar>Pagar ${moeda(total)} e comprar</button>`,
    ligar(raiz) {
      raiz.querySelectorAll('[data-metodo]').forEach((b) => b.addEventListener('click', () => { e.metodo = b.dataset.metodo; ctx.redesenhar(); }));
      raiz.querySelector('[data-comprar]').addEventListener('click', async (ev) => {
        ev.currentTarget.disabled = true;
        e.erro = '';
        try { e.comprado = await ctx.casos.comprarPacote({ clienteId: ctx.sessao.clienteId, diaristaId: id, duracao, metodo: e.metodo }); } catch (falha) { e.erro = falha.message; }
        ctx.redesenhar();
      });
    },
  };
}
