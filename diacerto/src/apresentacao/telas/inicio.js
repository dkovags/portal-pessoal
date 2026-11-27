import { html } from '../html.js';
import { icone } from '../componentes.js';

export async function telaInicio() {
  return { html: html`
    <header class="topo entre">
      <span class="marca">${icone.logo}<span>DiaCerto</span></span>
      <a class="link-forte" href="#/minhas">Minhas diaristas</a>
    </header>
    <section class="pilha">
      <span class="selo">Plano Piloto, Brasília</span>
      <p class="kicker">Qual o DiaCerto?</p>
      <h1 class="manchete">Escolha sua diarista e agende de novo com quem você confia.</h1>
      <p class="mudo">Compare perfis e horários. Pagamento organizado e suporte antes, durante e depois do atendimento.</p>
      <a class="btn" href="#/busca">Encontrar profissional</a>
      <a class="btn contorno" href="#/trabalhe">Quero trabalhar com o DiaCerto</a>
    </section>
    <section class="cartao aviso">${icone.cupom}<p><strong>Lançamento:</strong> use o cupom LANCAMENTO e ganhe R$ 30 de desconto em cada atendimento até [DATA FINAL DO LANÇAMENTO].</p></section>
    <section class="pilha">
      <h2 class="subtitulo">Como funciona</h2>
      <ol class="passos">
        <li><strong>Escolha pelo perfil.</strong> Preço total, tarefas, experiência e avaliações de atendimentos reais.</li>
        <li><strong>Reserve pelo app.</strong> Você só paga depois que a profissional aceita.</li>
        <li><strong>Gostou? Agende de novo</strong> com a mesma pessoa, avulso ou em pacote com desconto.</li>
      </ol>
    </section>
    <section class="cartao"><p class="mudo"><strong class="tinta">Acabou de chegar a Brasília?</strong> Sem indicação de ninguém, você encontra profissionais verificadas perto de casa.</p></section>
  ` };
}
