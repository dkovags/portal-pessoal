# DiaCerto – protótipo do piloto

Plataforma de contratação de diaristas, com piloto no Plano Piloto (Brasília). Publicado em
`pessoal.kovags.com/diacerto/` direto deste repositório, como o DizTudo.

Há dois modos:

- **Padrão (`/diacerto/`):** login Google e dados gravados no Postgres do Neon, no schema `diacerto` do banco
  `neondb` do projeto Neon `diztudo` (provisório). Só entram os e-mails da tabela `diacerto.autorizados`.
- **Demonstração (`/diacerto/?demo`):** sem login, com dados fictícios em memória. Recarregar volta ao início.

Em ambos os modos os dados de clientes e diaristas são fictícios e nenhum pagamento real é feito: autorizações,
capturas, estornos e notificações ficam registrados na tabela `diacerto.eventos`.

## Arquitetura em camadas

```
src/
  dominio/          regras de negócio puras: dinheiro, precificação, regras, ciclo do atendimento
  aplicacao/        casos de uso e portas (contratos que a infraestrutura implementa)
  infraestrutura/   adaptadores das portas
    memoria/        repositórios em memória e dados fictícios (modo demonstração e testes)
    neon/           repositórios sobre a Data API do Neon, login Google, pagamento e avisos registrados
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

Memória e Neon implementam as mesmas portas de `aplicacao/portas.js`; a raiz de composição em
`apresentacao/app.js` escolhe uma delas. Domínio, casos de uso e telas não mudam de um modo para o outro.

## Banco (provisório)

- `banco/001_esquema.sql`: tabelas, restrições (pisos, janela, coerência dos valores), permissões e RLS.
- `banco/002_carga_ficticia.sql`: carga inicial, gerada por `node banco/gerar-carga.js` (datas relativas ao dia da geração).
- `banco/003_candidaturas.sql`: cadastro assistido de diaristas (só resultado e data da verificação, sem cópias de documentos).
- Para dar acesso a outra pessoa: `insert into diacerto.autorizados (email) values ('pessoa@gmail.com');`
- A Data API do projeto expõe os schemas `public` (DizTudo) e `diacerto`, com CORS só para `https://pessoal.kovags.com`.

## Cadastro assistido de diaristas

- `#/trabalhe`: a candidata deixa nome, WhatsApp e região; o pedido entra na fila da operação.
- `#/operacao`: lista de candidaturas e início de um cadastro na hora.
- `#/operacao/cadastro/<id>`: seis etapas (dados, serviços, preços, agenda, verificação, revisão). A aprovação
  só é liberada sem pendências: preços acima do piso, agenda inicial, os seis itens de verificação conferidos e
  o aceite do código de conduta registrado. Aprovar cria o perfil (primeiro nome e inicial do sobrenome) e a
  agenda das próximas 3 semanas. A reprovação exige motivo, de uso interno.

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

Os adaptadores Neon são testados contra uma imitação da Data API (`testes/banco-falso.js`), sem rede.

## Pendências para sair do protótipo

- Provedor de pagamento com split e WhatsApp reais.
- As regras de cobrança, cancelamento e repasse rodam hoje no navegador. O banco barra valores incoerentes
  (restrições `check`), mas a versão real precisa dessas regras no servidor e de papéis separados para
  cliente, diarista e operação, em vez do acesso compartilhado de hoje.
- Sair do projeto `diztudo` para um projeto Neon próprio.
- Este repositório é público: dados reais de clientes e diaristas nunca devem entrar aqui.
