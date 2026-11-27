import { html } from '../html.js';
import { cabecalho, erro } from '../componentes.js';
import { dataCurta, horario } from '../formatos.js';
import { TIPOS_OCORRENCIA } from '../../dominio/index.js';

const TIPOS_POR_QUEM = {
  cliente: ['falta_diarista', 'atraso', 'dano', 'qualidade', 'seguranca', 'outro'],
  diarista: ['seguranca', 'acidente', 'outro', 'atraso', 'qualidade'],
};
const ROTULO_DIARISTA = { seguranca: 'Assédio, risco ou acesso inadequado', acidente: 'Acidente', outro: 'Tarefas diferentes do combinado ou outro problema', atraso: 'Cliente ausente ou atraso para abrir', qualidade: 'Condições do imóvel ou dos produtos' };

export async function telaAjuda(ctx, rota) {
  const de = rota.query.de === 'diarista' ? 'diarista' : 'cliente';
  const atendimentos = await ctx.casos.meusAtendimentos(de === 'cliente' ? { clienteId: ctx.sessao.clienteId } : { diaristaId: ctx.sessao.diaristaId });
  const e = ctx.estado(`ajuda-${de}`, { atendimentoId: rota.query.atendimento ?? atendimentos[0]?.id ?? '', tipo: TIPOS_POR_QUEM[de][0], descricao: '', erro: '', enviada: null });
  const voltar = de === 'diarista' ? '#/diarista' : '#/minhas';
  if (e.enviada) {
    return { html: html`
      ${cabecalho('Pedido de ajuda registrado', voltar)}
      <section class="cartao pilha-curta">
        <strong>${e.enviada.gravidade === 'grave' ? 'A operação foi avisada agora.' : 'Recebemos o seu relato.'}</strong>
        <span class="mudo pequeno">Vamos ouvir as duas partes antes de decidir. ${e.enviada.gravidade === 'grave' ? 'Resposta em até 72 horas, normalmente bem antes.' : 'Você recebe a resposta pelo WhatsApp.'}</span>
      </section>
      <a class="btn" href="${voltar}">Voltar</a>` };
  }
  return {
    html: html`
      ${cabecalho('Pedir ajuda', voltar)}
      <section class="cartao alerta pilha-curta">
        <strong>Em risco agora? Ligue 190 (Polícia) ou 192 (SAMU).</strong>
        <span class="mudo pequeno">Depois, registre aqui para a operação acompanhar.</span>
      </section>
      ${de === 'diarista' ? html`<p class="mudo pequeno">O cliente não é avisado deste pedido.</p>` : ''}
      ${atendimentos.length === 0
        ? html`<p class="cartao mudo">Não encontramos atendimentos nos últimos 30 dias. Fale com o suporte: WhatsApp [NÚMERO DE SUPORTE].</p>`
        : html`<form class="pilha-curta" data-ajuda>
          <label>Atendimento<select name="atendimentoId">${atendimentos.map((a) => html`<option value="${a.id}" ${a.id === e.atendimentoId ? html`selected` : ''}>${dataCurta(a.inicio)}, ${horario(a.horaInicio, a.horaFim)} · ${a.com}</option>`)}</select></label>
          <label>O que aconteceu<select name="tipo">${TIPOS_POR_QUEM[de].map((t) => html`<option value="${t}" ${t === e.tipo ? html`selected` : ''}>${de === 'diarista' ? ROTULO_DIARISTA[t] : TIPOS_OCORRENCIA[t]}</option>`)}</select></label>
          <label>Conte com detalhes<textarea name="descricao" maxlength="1000" required>${e.descricao}</textarea></label>
          ${erro(e.erro)}
          <button class="btn">Enviar pedido de ajuda</button>
        </form>`}
      <section class="cartao pilha-curta">
        <strong class="pequeno">Outros contatos</strong>
        <span class="mudo mini">WhatsApp: [NÚMERO DE SUPORTE] · E-mail: [E-MAIL DE SUPORTE]</span>
        <span class="mudo mini">Danos materiais: reembolso de até R$ 500 por ocorrência, conforme a Política de Reembolso.</span>
      </section>`,
    ligar(raiz) {
      raiz.querySelector('[data-ajuda]')?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        Object.assign(e, { atendimentoId: f.get('atendimentoId'), tipo: f.get('tipo'), descricao: f.get('descricao'), erro: '' });
        try {
          e.enviada = await ctx.casos.registrarOcorrencia({ atendimentoId: e.atendimentoId, tipo: e.tipo, gravidade: 'moderada', abertoPor: de, descricao: e.descricao });
        } catch (falha) { e.erro = falha.message; }
        ctx.redesenhar();
      });
    },
  };
}
