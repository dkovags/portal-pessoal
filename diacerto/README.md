# DiaCerto – protótipo do piloto

Plataforma de contratação de diaristas, com piloto no Plano Piloto (Brasília). Publicado em
`pessoal.kovags.com/diacerto/` direto deste repositório, como o DizTudo.

Há dois modos:

- **Padrão (`/diacerto/`):** login Google e todas as operações feitas pelo servidor (API do DiaCerto no Neon
  Functions, projeto Neon `diacerto`, AWS us-east-1). O navegador não acessa o banco nem calcula cobranças.
- **Demonstração (`/diacerto/?demo`):** sem login, com dados fictícios em memória no próprio navegador.

Os dados de clientes e diaristas ainda são fictícios e nenhum pagamento real é feito: autorizações, capturas,
estornos e avisos ficam registrados na tabela `diacerto.eventos`.

## Arquitetura em camadas

```
src/
  dominio/          regras de negócio puras: dinheiro, precificação, regras, ciclo do atendimento
  aplicacao/        casos de uso e portas (contratos que a infraestrutura implementa)
  infraestrutura/   adaptadores das portas
    memoria/        repositórios em memória e dados fictícios (modo demonstração e testes)
    postgres/       repositórios em SQL, usados pelo servidor (SQL sobre HTTP do Neon, sem dependências)
    api/            no navegador: login Google e os casos de uso chamados pela API
  apresentacao/     telas, roteador e raiz de composição do navegador (app.js)
    api/            servidor HTTP: login (JWT), permissões por papel e raiz de composição do servidor
servidor/           inicializador da função e lista de arquivos que ela carrega
```

Regra de dependência: cada camada só importa as camadas mais internas.

| Camada | Pode importar |
| --- | --- |
| dominio | dominio |
| aplicacao | dominio, aplicacao |
| infraestrutura | dominio, aplicacao, infraestrutura |
| apresentacao | todas (só `app.js` conhece a infraestrutura concreta) |

O teste `testes/camadas.test.js` verifica isso em cada arquivo. Ele também impede que domínio e aplicação
usem navegador ou rede.

O navegador e o servidor rodam as mesmas camadas de domínio e aplicação. No navegador, a raiz de composição
(`apresentacao/app.js`) usa os casos de uso remotos (`infraestrutura/api`) ou, no `?demo`, os em memória. No servidor,
a raiz (`apresentacao/api/funcao.js`) usa os repositórios Postgres.

## Servidor (Neon Functions)

- Função `api` no projeto Neon `diacerto` (us-east-1): `GET /saude`, `GET /eu` e `POST /casos/<nome>`.
- Login: o navegador envia o JWT do Neon Auth; o servidor verifica a assinatura (Ed25519) com WebCrypto.
- Perfis (`diacerto.perfis`): `operacao` faz tudo; `cliente` e `diarista` só agem em nome próprio, e o servidor
  substitui o cliente ou a diarista informados pelo navegador pelos do perfil logado. Sem login, só o pedido de
  contato (`#/trabalhe`) e a consulta das regras comerciais em vigor. Quem entrou com Google e não tem perfil só
  pode fazer o autocadastro de cliente, com o e-mail do próprio login.
- Reservar, comprar pacote, remarcar e aceitar pedido exigem os termos vigentes aceitos (a tela pede antes; o
  servidor confere). O aceite e a alteração de parâmetros ficam sempre em nome de quem está logado.
- O inicializador (`servidor/inicializador/index.mjs`) baixa do GitHub os arquivos de `servidor/arquivos.json`,
  fixados num commit pela variável `CODIGO_VERSAO`. Atualizar o servidor é trocar essa variável na função.
- Acessos: na Operação, aba Acessos (cadastrar cliente, dar acesso a diarista ou à operação, remover). O cadastro
  assistido também recebe o e-mail da diarista, e a aprovação já libera o acesso dela.

## Banco

- Projeto atual: `banco/projeto-diacerto/001_esquema.sql` (esquema) e `002_carga_ficticia.sql`
  (gerado por `node banco/gerar-carga.js`).
- `banco/projeto-diacerto/007`: local do atendimento, escopo do pedido e repasse com prazo (só acrescenta).
- `banco/projeto-diacerto/003` a `006`: e-mail da candidata, avaliações, remarcação e, no `006`, autocadastro com
  aceites, pacote completo e parâmetros com vigência. O `001` já inclui todas; o `006` só acrescenta (a coluna
  antiga `pacotes.usados` fica, sem uso) e troca o piso fixo do banco por um mínimo absoluto (R$ 50 e R$ 30).
- `banco/001` a `004`: esquema provisório usado antes no projeto Neon `diztudo`; ficou lá sem uso.

## Cadastro assistido de diaristas

- `#/trabalhe`: a candidata deixa nome, WhatsApp e região; o pedido entra na fila da operação.
- `#/operacao`: lista de candidaturas e início de um cadastro na hora.
- `#/operacao/cadastro/<id>`: seis etapas (dados, serviços, preços, agenda, verificação, revisão). A aprovação
  só é liberada sem pendências: preços acima do piso, agenda inicial, os seis itens de verificação conferidos e
  o aceite do código de conduta registrado. Aprovar cria o perfil (primeiro nome e inicial do sobrenome) e a
  agenda das próximas 3 semanas. A reprovação exige motivo, de uso interno.

## Painel da operação (`#/operacao`)

- **Cadastros:** fila de candidaturas e cadastro assistido.
- **Atendimentos:** todos os atendimentos, filtráveis por situação, com valores e ocorrências.
- **Ocorrências:** registro (dano, falta, atraso, qualidade, assédio ou risco, acidente) e resolução com reembolso.
  Assédio, risco e acidente são sempre graves e avisam a operação. Reembolso só em dano (até R$ 500) ou falta da
  profissional (até o valor pago), feito pelo provedor e nunca descontado da profissional.
- **Parâmetros:** comissão, taxas, piso, política de cancelamento e regras do pacote, com motivo obrigatório e
  histórico (quem, quando, o que mudou). Cada versão vale para reservas e pacotes novos; o que já foi contratado
  guarda os valores e a política da época. Quem ficou abaixo de um piso novo é listado, e o painel dela avisa.
- **Indicadores:** os critérios de interrupção do piloto (recompra em 30 dias, pares que sumiram, cancelamentos,
  faltas, margem de contribuição média e ocorrências graves abertas há mais de 72h), com faixa seguir, ajustar ou
  parar, além dos números do mês. Custos e faixas ficam em `src/dominio/parametros.js`.

## Cliente e profissional

- **Autocadastro (`#/boas-vindas`):** quem entra com Google sem ter acesso informa nome, celular, endereço e região
  e aceita os Termos de uso para clientes e a Política de privacidade. Diaristas continuam entrando pelo cadastro
  assistido. Os documentos (`src/apresentacao/textos-legais.js`, rascunhos para revisão jurídica) são versionados
  em `src/dominio/documentos.js`: mudou o texto, muda a versão nos dois lugares, e quem já tinha aceitado aceita
  de novo no próximo acesso (`diacerto.aceites` guarda e-mail, documento, versão e data). Os documentos abrem
  também sem login (`#/termos/<documento>`).
- **Pedido com escopo (RF02):** tipo de imóvel, quartos, banheiros e animais (lembrados para o próximo pedido),
  tarefas escolhidas dentro do que a profissional faz e quem fornece os produtos (ela marca no painel se pode
  levá-los). A diarista vê tudo isso antes de aceitar.
- **Endereço só depois do aceite (RF01):** endereço e instruções de acesso ficam em `diacerto.locais_atendimento`,
  fora do atendimento. A diarista recebe os dois só depois de aceitar e até o fim do dia do atendimento; o
  cliente muda as instruções até o atendimento começar; a operação vê no detalhe.
- **Conclusão com prazo (RF03):** a chegada por código não conclui mais. A diarista marca "Terminei", o cliente
  tem 24 horas para confirmar ou contestar, e só então o repasse é capturado (com chave de idempotência). Sem
  resposta, o repasse sai quando alguém consulta depois do prazo. Contestar, ou pedir ajuda dentro do prazo,
  abre ocorrência e segura o repasse; a operação decide liberar ou reter (o cliente recebe o valor de volta).
- **Pacote (`#/pacote/<diarista>`, `#/pacotes`):** compra explícita, paga de uma vez, com preço e política de
  cancelamento travados na compra. O saldo é calculado pelos atendimentos ligados ao pacote: pedido recusado ou
  cancelado no prazo devolve o atendimento; cancelado fora do prazo gasta o atendimento, paga a parte da
  profissional e devolve o resto. O cliente encerra quando quiser (inclusive vencido) e recebe o saldo; em até
  7 dias da compra, sem atendimento realizado, é a desistência com reembolso integral.

- **Cancelar:** antes de confirmar, o cliente vê quanto volta para ele e quanto fica com a profissional.
- **Remarcar:** uma vez, até 24 horas antes; o pedido volta para a profissional aceitar o novo dia, sem nova
  cobrança e sem gastar outro atendimento do pacote.
- **Pedir ajuda:** cliente ou profissional escolhe o atendimento e o que aconteceu; vira uma ocorrência na operação.
  Assédio, risco e acidente são graves e avisam a operação. A profissional pede ajuda sem o cliente saber.
- **Avaliações:** até 30 dias depois do atendimento concluído, uma por lado. A do cliente aparece no perfil da
  profissional sem identificar o cliente; a da profissional sobre o cliente é interna. A operação vê as duas.

## Regras de negócio implementadas

Os valores iniciais são hipóteses do piloto (`src/dominio/parametros.js`); os marcados com * a operação altera
na aba Parâmetros, e a versão em vigor fica em `diacerto.parametros`:

- Comissão sobre o serviço*: 20% no avulso e 15% no pacote. Nunca incide sobre o transporte.
- Taxa de serviço do cliente*: R$ 15 no avulso e R$ 12 no pacote.
- Cupom custeado pela plataforma, limitado à receita dela; nunca reduz o que a diarista recebe. Não vale no pacote.
- Pacote* de 4 atendimentos, desconto definido pela diarista (até 30%), validade de 3 meses.
- Piso*: diária R$ 130 e meia diária R$ 70.
- Até 2 atendimentos por semana da mesma diarista no mesmo cliente.
- Janela de funcionamento das 7h às 20h; a diarista define a própria agenda dentro dela.
- Cobrança avulsa só depois do aceite da diarista; pacote pago na compra. Repasse com split na conclusão.
- Código de confirmação libera o pagamento; não mede jornada.
- Cancelamento* gratuito até 24h antes; depois, 50% do valor da diarista fica com ela. Vale a política gravada
  na reserva (ou no pacote).
- O endereço do cliente vai para a profissional depois que ela aceita o pedido.

## Testes

Requer Node 20 ou superior, sem dependências externas.

```
cd diacerto
npm test
```

Os repositórios Postgres e a API são testados contra um Postgres local, quando há um:

```
DIACERTO_PG="host=127.0.0.1 port=5432 user=postgres" npm test
```

Sem `DIACERTO_PG`, esses testes são pulados.

## Pendências para sair do protótipo

- Provedor de pagamento com split e WhatsApp reais.
- Tarefa agendada para liberar repasses vencidos sem depender de consulta (hoje a liberação roda quando alguém abre as telas).
- Revisão jurídica dos termos e da política de privacidade, com os dados entre colchetes preenchidos.
- Operações com várias gravações (aprovar cadastro) ainda não são atômicas.
- Este repositório é público: dados reais de clientes e diaristas nunca devem entrar aqui.
