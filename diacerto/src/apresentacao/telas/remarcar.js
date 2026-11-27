import { html } from '../html.js';
import { cabecalho, erro } from '../componentes.js';
import { dataCurta, dataLonga, horario } from '../formatos.js';

const HORAS = { diaria: 9, meiaDiaria: 4 };

export async function telaRemarcar(ctx, rota) {
  const id = rota.params[0];
  const duracao = rota.query.duracao === 'meiaDiaria' ? 'meiaDiaria' : 'diaria';
  const perfil = await ctx.casos.obterPerfil(rota.query.diarista, duracao);
  const e = ctx.estado('remarcar-' + id, { data: perfil.proximosHorarios[0]?.data ?? '', hora: null, erro: '', feito: null });
  if (e.feito) {
    return { html: html`
      ${cabecalho('Pedido de remarcação enviado', '#/minhas')}
      <section class="cartao pilha-curta">
        <strong>${perfil.nome} · ${dataLonga(e.feito.inicio)}</strong>
        <span class="mudo pequeno">${horario(e.feito.horaInicio, e.feito.horaFim)}</span>
        <span class="destaque pequeno">Aguardando a profissional confirmar o novo dia. Não há cobrança nova.</span>
      </section>
      <a class="btn" href="#/minhas">Voltar</a>` };
  }
  const janela = perfil.proximosHorarios.find((h) => h.data === e.data);
  const inicios = janela ? Array.from({ length: Math.max(0, janela.fim - janela.inicio - HORAS[duracao] + 1) }, (_, i) => janela.inicio + i) : [];
  if (!inicios.includes(e.hora)) e.hora = inicios[0] ?? null;
  return {
    html: html`
      ${cabecalho('Remarcar', '#/minhas')}
      <p class="mudo pequeno">Escolha um novo dia com ${perfil.nome}. Dá para remarcar uma vez, até 24 horas antes do horário marcado. Ela precisa confirmar o novo dia.</p>
      <section class="pilha-curta">
        <h2 class="subtitulo">Dias livres</h2>
        ${perfil.proximosHorarios.length === 0 ? html`<p class="cartao mudo">${perfil.nome} não tem dias livres agora. Você pode cancelar e reservar com outra profissional.</p>` : ''}
        <div class="chips">${perfil.proximosHorarios.map((h) => html`<button type="button" class="chip ${h.data === e.data ? html`ativo` : ''}" data-data="${h.data}">${dataCurta(h.data)}</button>`)}</div>
        ${inicios.length ? html`<label>Horário de início
          <select data-hora>${inicios.map((h) => html`<option value="${h}" ${h === e.hora ? html`selected` : ''}>${horario(h, h + HORAS[duracao])}</option>`)}</select></label>` : ''}
      </section>
      ${erro(e.erro)}
      <button type="button" class="btn" data-remarcar ${e.hora === null ? html`disabled` : ''}>Pedir remarcação</button>`,
    ligar(raiz) {
      raiz.querySelectorAll('[data-data]').forEach((b) => b.addEventListener('click', () => { e.data = b.dataset.data; e.hora = null; ctx.redesenhar(); }));
      raiz.querySelector('[data-hora]')?.addEventListener('change', (ev) => { e.hora = Number(ev.target.value); });
      raiz.querySelector('[data-remarcar]').addEventListener('click', async () => {
        e.erro = '';
        try { e.feito = await ctx.casos.remarcarAtendimento({ atendimentoId: id, clienteId: ctx.sessao.clienteId, data: e.data, horaInicio: e.hora }); } catch (falha) { e.erro = falha.message; }
        ctx.redesenhar();
      });
    },
  };
}
