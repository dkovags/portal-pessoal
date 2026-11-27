# pessoal.kovags.com

Porta de entrada da área **Pessoal** do portal kovags.com, publicada pelo GitHub Pages com domínio próprio.

As páginas **não ficam aqui**: continuam no cPanel, em `kovags.com/pessoal/` (inclusive o que é publicado pelo
`publicar.php`). O `index.html` (e o `404.html`, para os demais caminhos) busca a página do caminho pedido
em `https://kovags.com/pessoal/<caminho>/index.html?carregar=1` e a abre neste endereço, com um `<base>` que faz
os links e arquivos apontarem para o kovags.com.

No kovags.com, o `.htaccess` libera CORS para este endereço e redireciona `kovags.com/pessoal/` para cá
(o parâmetro `carregar=1` evita o redirecionamento quando a página é buscada por esta porta).

## DiaCerto (`/diacerto/`)

Protótipo da plataforma de contratação de diaristas, em camadas (domínio, aplicação, infraestrutura,
apresentação), publicado em `pessoal.kovags.com/diacerto/` direto deste repositório. Roda com dados fictícios em
memória. Detalhes e testes em [`diacerto/README.md`](diacerto/README.md).

## DizTudo (`/diztudo/`)

Planejador de estudos para concursos, publicado em `pessoal.kovags.com/diztudo/` direto deste repositório
(é uma página real daqui, não passa pela porta do cPanel).

- **Acesso:** login Google pelo Neon Auth do projeto Neon `diztudo` (sa-east-1). Só `kovags@gmail.com` entra.
- **Dados:** tabela `public.estado` (um registro por usuário, com `dados` e `provas` em JSONB), lida pela Data API.
  A RLS só libera a linha do próprio usuário e só se o e-mail dele estiver em `public.autorizados`. Para dar acesso
  a outra pessoa, inclua o e-mail nessa tabela e na constante `PERMITIDO` da página.
- **IA:** desligada nesta versão (geração de questões, extração de edital e separação de itens de provas).
  Ligá-la exige uma função no servidor com a chave da API da Anthropic.
