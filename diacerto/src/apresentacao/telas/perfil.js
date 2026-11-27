import { html } from '../html.js';
import { cabecalho, avatar, CORES } from '../componentes.js';
import { moeda, nota, percentual } from '../formatos.js';

export async function telaPerfil(ctx, rota) {
  const id = rota.params[0];
  const duracao = rota.query.duracao ?? 'diaria';
  const p = await ctx.casos.obterPerfil(id, duracao);
  const sim = await ctx.casos.simularReserva({ diaristaId: id, clienteId: ctx.sessao.clienteId, duracao });
  const estado = ctx.estado('perfil-' + id, { plano: sim.pacoteAtivo ? 'pacote' : 'avulso' });
  const destino = '#/reserva/' + id + '?' + new URLSearchParams({ duracao, modalidade: estado.plano, data: rota.query.data ?? '' });
  const restante = sim.pacoteAtivo ? sim.pacoteAtivo.total - sim.pacoteAtivo.usados : 0;

  return {
    html: html`
      ${cabecalho('', '#/busca')}
      <section class="linha">
        ${avatar(p.iniciais, CORES[p.id], 72)}
        <div class="pilha-curta">
          <h1 class="titulo">${p.nome}</h1>
          <span class="mudo pequeno">${nota(p.nota)}${p.nota ? html` em ${p.atendimentos} atendimentos` : ''} · ${p.anosExperiencia} anos de experiência</span>
          <span class="mudo pequeno">Atende ${p.regioes.join(', ')}</span>
        </div>
      </section>
      <section class="cartao pilha-curta">
        <h2 class="subtitulo">O que foi verificado</h2>
        <p class="mudo pequeno">${p.verificacao.resultado} Verificação em ${p.verificacao.data}. A verificação reduz riscos, mas não os elimina.</p>
      </section>
      <section class="pilha-curta">
        <h2 class="subtitulo">O que ela faz</h2>
        <div class="chips">${p.tarefas.map((t) => html`<span class="etiqueta neutra">${t}</span>`)}</div>
        <p class="mudo pequeno">Não faz: ${p.naoFaz} Produtos e equipamentos ficam por conta do cliente.</p>
      </section>
      <section class="pilha-curta" role="radiogroup" aria-label="Como contratar">
        <h2 class="subtitulo">Como contratar</h2>
        ${sim.pacoteAtivo ? html`<p class="cartao aviso-texto">Você tem um pacote com ${p.nome}: ${restante} de ${sim.pacoteAtivo.total} atendimentos restantes.</p>` : ''}
        <button type="button" class="opcao ${estado.plano === 'avulso' ? html`ativa` : ''}" data-plano="avulso" role="radio" aria-checked="${estado.plano === 'avulso'}" ${sim.pacoteAtivo ? html`disabled` : ''}>
          <span class="entre"><strong>Atendimento avulso</strong><strong>${moeda(p.avulso.totalCliente)}</strong></span>
          <span class="mudo mini">${p.horas} horas. Serviço ${moeda(p.avulso.servico)}, transporte ${moeda(p.avulso.transporte)}, taxa DiaCerto ${moeda(p.avulso.taxaCliente)}.</span>
        </button>
        <button type="button" class="opcao ${estado.plano === 'pacote' ? html`ativa` : ''}" data-plano="pacote" role="radio" aria-checked="${estado.plano === 'pacote'}">
          <span class="entre"><strong>Pacote de ${p.pacote.quantidade} atendimentos</strong><strong>${moeda(p.pacote.totalCliente)} cada</strong></span>
          <span class="mudo mini">${percentual(p.pacote.desconto)} de desconto definido pela ${p.nome.split(' ')[0]}. Validade de ${p.pacote.validadeMeses} meses. Saldo não usado é reembolsado.</span>
        </button>
      </section>
      <section class="pilha-curta">
        <h2 class="subtitulo">Avaliações de atendimentos realizados</h2>
        ${p.avaliacoes.length === 0 ? html`<p class="mudo pequeno">Ainda sem avaliações. Toda avaliação vem de um atendimento concluído.</p>` : ''}
        ${p.avaliacoes.map((a) => html`<div class="cartao"><strong class="pequeno">${a.texto} · ${nota(a.nota)}</strong><span class="mudo mini bloco">${a.autor}, ${a.mes}</span></div>`)}
      </section>
      <a class="btn fixo" href="${destino}">${estado.plano === 'avulso' ? 'Escolher data e horário' : (sim.pacoteAtivo ? 'Agendar pelo pacote' : 'Contratar pacote e agendar o 1º')}</a>`,
    ligar(raiz) {
      raiz.querySelectorAll('[data-plano]').forEach((b) => b.addEventListener('click', () => {
        estado.plano = b.dataset.plano; ctx.redesenhar();
      }));
    },
  };
}
