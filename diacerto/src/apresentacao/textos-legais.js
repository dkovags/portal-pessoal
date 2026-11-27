// Textos dos documentos que clientes e profissionais aceitam (RF14). A versão de cada texto
// precisa ser igual à de DOCUMENTOS_LEGAIS no domínio: mudou o texto, muda a versão nos dois
// lugares, e quem já aceitou é chamado a aceitar de novo. RASCUNHOS: precisam de revisão
// jurídica e dos dados entre colchetes antes do lançamento.

const AVISO = 'Rascunho para revisão jurídica. Os trechos entre colchetes ainda precisam ser preenchidos.';

export const TEXTOS_LEGAIS = Object.freeze({
  'termos-cliente': {
    titulo: 'Termos de uso para clientes',
    versao: '2026-11-27',
    aviso: AVISO,
    secoes: [
      { titulo: '1. O que é o DiaCerto', paragrafos: [
        'O DiaCerto é uma plataforma de intermediação operada por [RAZÃO SOCIAL], CNPJ [CNPJ], com sede em [ENDEREÇO]. Ela aproxima clientes e profissionais autônomas de limpeza residencial no Plano Piloto, em Brasília.',
        'O DiaCerto não presta o serviço de limpeza e não emprega as profissionais. Cada atendimento é contratado entre você e a profissional, por meio da plataforma.',
        'Para manter o caráter eventual do serviço, a mesma profissional atende o mesmo cliente no máximo duas vezes por semana pela plataforma.',
      ] },
      { titulo: '2. Cadastro', paragrafos: [
        'Você entra com a sua conta Google e informa nome, celular com DDD, endereço e região. Os dados precisam ser verdadeiros e estar atualizados, porque é com eles que a profissional chega até você e que o suporte fala com você.',
        'Para contratar, você declara ter 18 anos ou mais. A conta é pessoal: não a empreste.',
      ] },
      { titulo: '3. Como funciona uma reserva', paragrafos: [
        'Você escolhe a profissional, o dia e o horário dentro da agenda que ela abriu, e envia o pedido. A cobrança só acontece depois que ela aceita.',
        'No dia, informe à profissional o código de confirmação que aparece no app. O código registra a chegada e libera o pagamento dela ao fim do atendimento.',
        'As tarefas que cada profissional faz e não faz estão no perfil dela. Produtos e equipamentos de limpeza ficam por conta do cliente, salvo combinação diferente registrada na reserva.',
      ] },
      { titulo: '4. Preços e pagamento', paragrafos: [
        'O preço do serviço é definido pela profissional, respeitado um valor mínimo da plataforma. A taxa do DiaCerto, o transporte e o total aparecem na revisão da reserva, antes de você confirmar.',
        'O pagamento é feito por Pix ou cartão por meio de [PROVEDOR DE PAGAMENTO]. O DiaCerto não guarda os dados do seu cartão. O valor da profissional é repassado a ela depois do atendimento.',
      ] },
      { titulo: '5. Pacotes', paragrafos: [
        'O pacote reúne um número de atendimentos com a mesma profissional, pagos de uma vez, com o preço de cada atendimento travado na compra. A quantidade, o desconto e a validade aparecem antes da compra.',
        'Você agenda os atendimentos do pacote um a um, conforme a agenda da profissional. Pode encerrar o pacote quando quiser e receber de volta o valor dos atendimentos não usados. Vencida a validade, o saldo também pode ser pedido de volta.',
        'Direito de arrependimento: em até 7 dias da compra, se nenhum atendimento do pacote tiver sido realizado, você pode desistir e receber de volta todo o valor pago (art. 49 do Código de Defesa do Consumidor).',
      ] },
      { titulo: '6. Cancelamento e remarcação', paragrafos: [
        'Antes do aceite, o cancelamento é sempre sem custo. Depois do aceite, vale a política de cancelamento mostrada na revisão da reserva, que fica gravada nela: até um prazo antes do horário, sem custo; depois dele, uma parte do valor da profissional fica com ela, que reservou o dia, e o restante volta para você.',
        'No pacote, o cancelamento sem custo devolve o atendimento ao saldo. O cancelamento fora do prazo gasta o atendimento, e o que não fica com a profissional volta para você.',
        'Cada reserva pode ser remarcada uma vez, até 24 horas antes do horário, sem cobrança nova. A profissional confirma a nova data.',
      ] },
      { titulo: '7. Avaliações', paragrafos: [
        'Depois de um atendimento concluído, você e a profissional podem se avaliar em até 30 dias. A sua avaliação aparece no perfil dela, sem o seu nome. A avaliação que ela faz de você é vista só pela equipe do DiaCerto.',
        'Avaliações ofensivas ou que exponham dados de alguém podem ser removidas.',
      ] },
      { titulo: '8. Problemas, danos e reembolsos', paragrafos: [
        'Se algo der errado, use "Pedir ajuda" no app. A operação ouve as duas partes antes de decidir.',
        'Danos materiais causados durante o atendimento são reembolsados em até R$ 500,00 por ocorrência, conforme a Política de Reembolso. Se a profissional faltar, o valor pago é devolvido.',
        'No piloto, o DiaCerto não contrata seguro contra furto, acidentes ou danos.',
      ] },
      { titulo: '9. Responsabilidades', paragrafos: [
        'O DiaCerto verifica documento com foto, certidões de antecedentes e referências das profissionais antes de liberar o perfil. A verificação reduz riscos, mas não os elimina.',
        'O DiaCerto responde pela intermediação que presta, nos termos do Código de Defesa do Consumidor. [CLÁUSULAS DE RESPONSABILIDADE A REVISAR]',
      ] },
      { titulo: '10. Encerramento da conta', paragrafos: [
        'Você pode pedir o encerramento da conta a qualquer momento pelo suporte. O DiaCerto pode suspender contas em caso de violação destes termos, depois de ouvir a pessoa.',
      ] },
      { titulo: '11. Mudanças nestes termos', paragrafos: [
        'Quando estes termos mudarem, o app pede o seu aceite da nova versão no próximo acesso. Reservas e pacotes já contratados mantêm as condições da época.',
      ] },
      { titulo: '12. Contato e foro', paragrafos: [
        'Atendimento: [E-MAIL DE ATENDIMENTO]. Vale a lei brasileira, e o foro é o do domicílio do consumidor.',
      ] },
    ],
  },

  'termos-profissional': {
    titulo: 'Termos de uso para profissionais',
    versao: '2026-11-27',
    aviso: AVISO,
    secoes: [
      { titulo: '1. Natureza da relação', paragrafos: [
        'Você usa o DiaCerto como profissional autônoma. Não há vínculo de emprego com o DiaCerto, operado por [RAZÃO SOCIAL], CNPJ [CNPJ], nem com os clientes.',
        'Você define os seus preços, respeitado o valor mínimo da plataforma, os dias e horários da sua agenda e as tarefas que faz. Aceita ou recusa cada pedido livremente e pode atender fora da plataforma.',
      ] },
      { titulo: '2. Cadastro e verificação', paragrafos: [
        'O cadastro é feito com a equipe do DiaCerto e inclui documento com foto, certidões de antecedentes, referências e uma conversa. Os dados precisam ser verdadeiros e atualizados.',
        'O que o cliente vê de você: nome abreviado, iniciais, anos de experiência, regiões, tarefas, preços, avaliações e um resumo do que foi verificado.',
      ] },
      { titulo: '3. Pedidos e atendimentos', paragrafos: [
        'Você recebe o pedido e decide se aceita. Na chegada, peça ao cliente o código de confirmação e registre no app. Ao terminar, marque o atendimento como concluído.',
        'A mesma profissional atende o mesmo cliente no máximo duas vezes por semana pela plataforma.',
        'Você pode recusar qualquer tarefa insegura ou fora do combinado, como trabalho em altura.',
      ] },
      { titulo: '4. Preços, comissão e repasse', paragrafos: [
        'O DiaCerto fica com uma comissão sobre o valor do serviço, com percentuais diferentes para atendimento avulso e para pacote. Os percentuais em vigor aparecem no seu painel, e cada atendimento guarda os valores da época em que foi contratado. O transporte é todo seu.',
        'O repasse é feito por [PROVEDOR DE PAGAMENTO] depois do atendimento concluído, nos prazos do provedor.',
      ] },
      { titulo: '5. Cancelamentos e faltas', paragrafos: [
        'Se o cliente cancelar fora do prazo sem custo, você recebe a parte do seu valor prevista na política gravada na reserva.',
        'Se você não puder ir, avise o quanto antes pelo app ou pelo suporte. Faltas sem aviso repetidas podem levar ao descredenciamento.',
      ] },
      { titulo: '6. Avaliações e conduta', paragrafos: [
        'Depois de cada atendimento concluído, você e o cliente podem se avaliar em até 30 dias. As avaliações dos clientes aparecem no seu perfil.',
        'Você se compromete a seguir o código de conduta aceito no cadastro: respeito, cuidado com os objetos da casa e sigilo sobre o que vê nela.',
      ] },
      { titulo: '7. Ocorrências e danos', paragrafos: [
        'Quando há uma ocorrência, a operação ouve as duas partes antes de decidir. O reembolso de danos ao cliente segue a Política de Reembolso. [REGRAS SOBRE PARTICIPAÇÃO DA PROFISSIONAL EM DANOS A DEFINIR]',
      ] },
      { titulo: '8. Seguro e previdência', paragrafos: [
        'No piloto, o DiaCerto não contrata seguro de acidentes pessoais para as profissionais. Recomendamos contribuir para o INSS como MEI ou contribuinte individual.',
      ] },
      { titulo: '9. Descredenciamento', paragrafos: [
        'O DiaCerto pode descredenciar profissionais em caso de violação destes termos ou do código de conduta, depois de ouvi-las. Não há multa. Você pode pedir o seu descredenciamento a qualquer momento.',
      ] },
      { titulo: '10. Mudanças, contato e foro', paragrafos: [
        'Quando estes termos mudarem, o app pede o seu aceite da nova versão no próximo acesso.',
        'Contato: [E-MAIL DE ATENDIMENTO]. Vale a lei brasileira. Foro: [FORO A DEFINIR].',
      ] },
    ],
  },

  privacidade: {
    titulo: 'Política de privacidade',
    versao: '2026-11-27',
    aviso: AVISO,
    secoes: [
      { titulo: '1. Quem cuida dos seus dados', paragrafos: [
        'O controlador dos dados é [RAZÃO SOCIAL], CNPJ [CNPJ], com sede em [ENDEREÇO]. O encarregado pelo tratamento de dados pessoais é [NOME DO ENCARREGADO], que atende em [E-MAIL DO ENCARREGADO].',
      ] },
      { titulo: '2. Quais dados tratamos', paragrafos: [
        'De clientes: nome, e-mail da conta Google, celular, endereço, região, reservas, pacotes, avaliações e conversas com o suporte.',
        'De profissionais: nome, celular, e-mail, documento com foto, certidões de antecedentes, referências, regiões, tarefas, preços, agenda, atendimentos e avaliações.',
        'De todos: registros de acesso e o aceite destes documentos, com data e versão. Os dados de cartão ficam com o provedor de pagamento; o DiaCerto não os guarda.',
      ] },
      { titulo: '3. Para que usamos e com que base legal', paragrafos: [
        'Para fazer funcionar as reservas, os pacotes, os pagamentos e o suporte, isto é, para executar o contrato com você (art. 7º, V, da LGPD).',
        'Para cumprir obrigações legais, como as fiscais e a guarda de registros de acesso (art. 7º, II).',
        'Para a segurança de clientes e profissionais, inclusive a verificação das profissionais, e para prevenir fraudes, com base no legítimo interesse (art. 7º, IX). [BASE LEGAL DA VERIFICAÇÃO DE ANTECEDENTES A CONFIRMAR]',
      ] },
      { titulo: '4. Com quem compartilhamos', paragrafos: [
        'Entre as partes de uma reserva, só o necessário: o cliente vê o perfil público da profissional, e a profissional vê o nome do cliente, as observações e o endereço do atendimento para poder chegar até lá.',
        'Com prestadores que fazem a plataforma funcionar: login (Google), banco de dados e servidor (Neon, sobre a Amazon Web Services), hospedagem do site (GitHub) e pagamento ([PROVEDOR DE PAGAMENTO]). Com autoridades, quando a lei exigir.',
        'Não vendemos dados pessoais.',
      ] },
      { titulo: '5. Dados fora do Brasil', paragrafos: [
        'O banco de dados e o servidor do DiaCerto ficam nos Estados Unidos (região us-east-1). A transferência internacional segue o art. 33 da LGPD. [MECANISMO DE TRANSFERÊNCIA A CONFIRMAR]',
      ] },
      { titulo: '6. Por quanto tempo guardamos', paragrafos: [
        'Enquanto a sua conta existir. Depois do encerramento, guardamos apenas o necessário para cumprir a lei e para a defesa em eventuais disputas, como registros fiscais, registros de acesso e os aceites destes documentos. [PRAZOS A CONFIRMAR]',
      ] },
      { titulo: '7. Seus direitos', paragrafos: [
        'Você pode pedir confirmação e acesso aos seus dados, correção, anonimização, bloqueio ou eliminação do que for desnecessário, portabilidade, informação sobre compartilhamentos e revisão de decisões automatizadas (art. 18 da LGPD).',
        'Peça pelo e-mail do encarregado. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).',
      ] },
      { titulo: '8. Segurança', paragrafos: [
        'O acesso é feito com a sua conta Google, as conexões são criptografadas e cada pessoa só vê o que o seu papel permite. Mudanças nas regras comerciais ficam registradas com autor, data e motivo.',
      ] },
      { titulo: '9. Armazenamento no navegador', paragrafos: [
        'O site guarda no seu navegador apenas o necessário para manter você conectado. Não usamos cookies de publicidade.',
      ] },
      { titulo: '10. Idade mínima', paragrafos: [
        'O DiaCerto é destinado a maiores de 18 anos.',
      ] },
      { titulo: '11. Mudanças nesta política', paragrafos: [
        'Quando esta política mudar, o app pede o seu aceite da nova versão no próximo acesso.',
      ] },
    ],
  },
});
