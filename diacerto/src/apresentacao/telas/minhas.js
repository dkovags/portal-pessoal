import { html } from '../html.js';
import { avatar, CORES, icone } from '../componentes.js';
import { dataLonga, dataCurta, horario } from '../formatos.js';

export async function telaMinhas(ctx) {
  const lista = await ctx.casos.minhasDiaristas(ctx.sessao.clienteId);
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
        <a class="btn claro-btn" href="#/ajuda">Falar com o suporte</a>
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
  ` };
}
