# DiaCerto – protótipo do piloto

Plataforma de contratação de diaristas, com piloto no Plano Piloto (Brasília). Publicado em
`pessoal.kovags.com/diacerto/` direto deste repositório, como o DizTudo.

Esta versão roda inteira no navegador, com **dados fictícios em memória**: nada é gravado e nenhum pagamento
é feito. Recarregar a página volta tudo ao estado inicial.

## Arquitetura em camadas

```
src/
  dominio/          regras de negócio puras: dinheiro, precificação, regras, ciclo do atendimento
  aplicacao/        casos de uso e portas (contratos que a infraestrutura implementa)
  infraestrutura/   adaptadores das portas: hoje em memória; depois Neon/Postgres, pagamento, WhatsApp
  apresentacao/     telas, roteador e raiz de composição (app.js)
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

Para trocar a memória por um banco, basta escrever novos adaptadores para as portas de `aplicacao/portas.js`
e mudar a raiz de composição em `apresentacao/app.js`. Domínio, casos de uso e telas não mudam.

## Regras de negócio implementadas

Os valores são hipóteses do piloto, centralizados em `src/dominio/parametros.js`:

- Comissão sobre o serviço: 20% no avulso e 15% no pacote. Nunca incide sobre o transporte.
- Taxa de serviço do cliente: R$ 15 no avulso e R$ 12 no pacote.
- Cupom custeado pela plataforma, limitado à receita dela; nunca reduz o que a diarista recebe.
- Pacote de 4 atendimentos, desconto definido pela diarista (até 30%), validade de 3 meses.
- Piso: diária R$ 130 e meia diária R$ 70.
- Até 2 atendimentos por semana da mesma diarista no mesmo cliente.
- Janela de funcionamento das 7h às 20h; a diarista define a própria agenda dentro dela.
- Cobrança só depois do aceite da diarista. Repasse com split na conclusão.
- Código de confirmação libera o pagamento; não mede jornada.
- Cancelamento gratuito até 24h antes; depois, 50% do valor da diarista fica com ela.

## Testes

Requer Node 20 ou superior, sem dependências externas.

```
cd diacerto
npm test
```

## Pendências para sair do protótipo

- Adaptadores de banco (Neon), autenticação, provedor de pagamento com split e WhatsApp.
- As regras de cobrança, cancelamento e repasse precisam rodar no servidor; no navegador elas servem só
  para o protótipo.
- Este repositório é público: dados reais de clientes e diaristas nunca devem entrar aqui.
