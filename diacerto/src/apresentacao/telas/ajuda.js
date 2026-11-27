import { html } from '../html.js';
import { cabecalho } from '../componentes.js';

export async function telaAjuda() {
  return { html: html`
    ${cabecalho('Ajuda', '#/')}
    <section class="cartao pilha-curta">
      <strong>Em caso de risco, ligue 190 (Polícia) ou 192 (SAMU).</strong>
      <span class="mudo pequeno">Depois, avise o DiaCerto para registrarmos a ocorrência.</span>
    </section>
    <section class="cartao pilha-curta">
      <strong>Suporte DiaCerto</strong>
      <span class="mudo pequeno">WhatsApp: [NÚMERO DE SUPORTE] · E-mail: [E-MAIL DE SUPORTE]</span>
      <span class="mudo mini">Profissionais podem pedir ajuda sem avisar o cliente: assédio, risco no local, acesso inadequado ou tarefas diferentes das combinadas.</span>
    </section>
    <section class="cartao pilha-curta">
      <strong>Danos e reembolsos</strong>
      <span class="mudo pequeno">Reembolso de até R$ 500 por ocorrência, conforme a Política de Reembolso. Ouvimos as duas partes antes de decidir.</span>
    </section>` };
}
