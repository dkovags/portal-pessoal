import { html } from '../html.js';
import { cabecalho, erro } from '../componentes.js';
import { moeda, dataCurta, dataLonga, horario } from '../formatos.js';

const HORAS = { diaria: 9, meiaDiaria: 4 }; // diária: 8h de serviço + 1h de intervalo

export async function telaReserva(ctx, rota) {
  const id = rota.params[0];
  const duracao = rota.query.duracao ?? 'diaria';
  const perfil = await ctx.casos.obterPerfil(id, duracao);
  const e = ctx.estado('reserva-' + id, {
    data: rota.query.data || perfil.proximosHorarios[0]?.data || '', hora: null,
    cupom: 'LANCAMENTO', cupomDigitado: 'LANCAMENTO', metodo: 'pix', observacoes: '', erro: '', enviado: null,
  });

  if (e.enviado) {
    return { html: html`
      ${cabecalho('Pedido enviado', '#/minhas')}
      <section class="cartao pilha-curta">
        <strong>${perfil.nome} · ${dataLonga(e.enviado.inicio)}</strong>
        <span class="mudo pequeno">${horario(e.enviado.horaInicio, e.enviado.horaFim)} · ${moeda(e.enviado.valores.totalCliente)}</span>
        <span class="destaque pequeno">Aguardando a profissional aceitar. Você só é cobrado depois do aceite.</span>
      </section>
      <section class="cartao pilha-curta">
        <strong class="pequeno">Seu código de confirmação: ${e.enviado.codigoConfirmacao}</strong>
        <span class="mudo mini">Informe à profissional quando ela chegar. O código libera o pagamento dela.</span>
      </section>
      <a class="btn" href="#/minhas">Ver minhas diaristas</a>` };
  }

  const janela = perfil.proximosHorarios.find((h) => h.data === e.data);
  const inicios = janela ? Array.from({ length: Math.max(0, janela.fim - janela.inicio - HORAS[duracao] + 1) }, (_, i) => janela.inicio + i) : [];
  if (!inicios.includes(e.hora)) e.hora = inicios[0] ?? null;

  let sim; let erroCupom = '';
  try {
    sim = await ctx.casos.simularReserva({ diaristaId: id, clienteId: ctx.sessao.clienteId, duracao, modalidade: rota.query.modalidade ?? 'avulso', codigoCupom: e.cupom || undefined });
  } catch (falha) {
    erroCupom = falha.message; e.cupom = '';
    sim = await ctx.casos.simularReserva({ diaristaId: id, clienteId: ctx.sessao.clienteId, duracao, modalidade: rota.query.modalidade ?? 'avulso' });
  }
  const v = sim.valores;

  return {
    html: html`
      ${cabecalho('Revisar reserva', '#/profissional/' + id + '?duracao=' + duracao)}
      <section class="cartao pilha-curta">
        <strong>${perfil.nome} · ${sim.modalidade === 'pacote' ? 'Pacote' : 'Atendimento avulso'}</strong>
        <span class="mudo pequeno">${duracao === 'diaria' ? '8 horas de serviço, com 1 hora de intervalo' : '4 horas de serviço'}</span>
      </section>
      <section class="pilha-curta">
        <h2 class="subtitulo">Quando</h2>
        <div class="chips">${perfil.proximosHorarios.map((h) => html`<button type="button" class="chip ${h.data === e.data ? html`ativo` : ''}" data-data="${h.data}">${dataCurta(h.data)}</button>`)}</div>
        ${inicios.length ? html`<label>Horário de início
          <select data-hora>${inicios.map((h) => html`<option value="${h}" ${h === e.hora ? html`selected` : ''}>${horario(h, h + HORAS[duracao])}</option>`)}</select></label>`
          : html`<p class="mudo pequeno">Escolha um dia com horário livre.</p>`}
      </section>
      <label class="pilha-curta">Observações para a profissional
        <textarea data-obs maxlength="500" placeholder="Ex.: tenho um gato; a chave fica na portaria.">${e.observacoes}</textarea></label>
      <section class="cartao pilha-curta">
        <h2 class="subtitulo">Valores</h2>
        <div class="entre"><span>Serviço${sim.modalidade === 'pacote' ? ' (com desconto do pacote)' : ''}</span><span>${moeda(v.servico)}</span></div>
        <div class="entre"><span>Transporte</span><span>${moeda(v.transporte)}</span></div>
        <div class="entre"><span>Taxa DiaCerto</span><span>${moeda(v.taxaCliente)}</span></div>
        ${v.cupom ? html`<div class="entre desconto"><span>Cupom ${e.cupom}</span><span>${moeda(-v.cupom)}</span></div>` : ''}
        <hr>
        <div class="entre total"><span>Total</span><span>${moeda(v.totalCliente)}</span></div>
        <p class="mudo mini">${perfil.nome.split(' ')[0]} recebe ${moeda(v.recebeDiarista)} (serviço e transporte). A taxa paga pagamento seguro, suporte e reembolso de danos.</p>
        <div class="linha">
          <label class="cresce">Cupom<input data-cupom value="${e.cupomDigitado}" autocomplete="off"></label>
          <button type="button" class="btn pequeno-btn contorno" data-aplicar>${v.cupom ? 'Trocar' : 'Aplicar'}</button>
        </div>
        ${erro(erroCupom)}
      </section>
      <section class="pilha-curta">
        <h2 class="subtitulo">Forma de pagamento</h2>
        <div class="grade2">
          ${[['pix', 'Pix'], ['cartao', 'Cartão de crédito']].map(([m, r]) => html`<button type="button" class="opcao centro ${e.metodo === m ? html`ativa` : ''}" data-metodo="${m}" aria-pressed="${e.metodo === m}">${r}</button>`)}
        </div>
      </section>
      <section class="cartao suave pilha-curta">
        <strong class="pequeno">Antes de confirmar</strong>
        <span class="mudo mini">Cancelamento gratuito até 24h antes. Depois disso, 50% do valor da profissional fica com ela.</span>
        <span class="mudo mini">Danos materiais: reembolso de até R$ 500 por ocorrência, conforme a Política de Reembolso. Não há seguro contra furto.</span>
      </section>
      ${erro(e.erro)}
      <button type="button" class="btn fixo" data-enviar ${e.hora === null ? html`disabled` : ''}>Enviar pedido de ${moeda(v.totalCliente)}</button>`,
    ligar(raiz) {
      raiz.querySelectorAll('[data-data]').forEach((b) => b.addEventListener('click', () => { e.data = b.dataset.data; e.hora = null; ctx.redesenhar(); }));
      raiz.querySelector('[data-hora]')?.addEventListener('change', (ev) => { e.hora = Number(ev.target.value); });
      raiz.querySelector('[data-obs]').addEventListener('input', (ev) => { e.observacoes = ev.target.value; });
      raiz.querySelector('[data-cupom]').addEventListener('input', (ev) => { e.cupomDigitado = ev.target.value; });
      raiz.querySelector('[data-aplicar]').addEventListener('click', () => { e.cupom = e.cupomDigitado.trim(); ctx.redesenhar(); });
      raiz.querySelectorAll('[data-metodo]').forEach((b) => b.addEventListener('click', () => { e.metodo = b.dataset.metodo; ctx.redesenhar(); }));
      raiz.querySelector('[data-enviar]').addEventListener('click', async () => {
        try {
          e.erro = '';
          e.enviado = await ctx.casos.solicitarReserva({
            clienteId: ctx.sessao.clienteId, diaristaId: id, data: e.data, horaInicio: e.hora, duracao,
            modalidade: sim.modalidade, metodo: e.metodo, observacoes: e.observacoes, codigoCupom: e.cupom || undefined,
          });
        } catch (falha) { e.erro = falha.message; }
        ctx.redesenhar();
      });
    },
  };
}
