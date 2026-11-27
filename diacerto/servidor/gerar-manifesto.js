// Lista os arquivos que o servidor carrega (camadas de domínio, aplicação, infraestrutura
// Postgres e a API). Uso: node servidor/gerar-manifesto.js > servidor/arquivos.json
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const listar = (dir) => readdirSync(join(raiz, dir)).flatMap((n) => {
  const p = join(dir, n);
  return statSync(join(raiz, p)).isDirectory() ? listar(p) : p.endsWith('.js') ? [p] : [];
});
const arquivos = [
  ...listar('src/dominio'), ...listar('src/aplicacao'), ...listar('src/infraestrutura/postgres'),
  'src/infraestrutura/mapeamento-sql.js', ...listar('src/apresentacao/api'),
].map((p) => relative(raiz, join(raiz, p)).split('\\').join('/')).sort();
console.log(JSON.stringify({ entrada: 'src/apresentacao/api/funcao.js', arquivos }, null, 2));
