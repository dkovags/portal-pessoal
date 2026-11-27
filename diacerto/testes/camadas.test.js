// Garante a regra de dependência: cada camada só importa camadas mais internas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const PERMITIDO = {
  dominio: ['dominio'],
  aplicacao: ['dominio', 'aplicacao'],
  infraestrutura: ['dominio', 'aplicacao', 'infraestrutura'],
  apresentacao: ['dominio', 'aplicacao', 'infraestrutura', 'apresentacao'],
};

function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith('.js') ? [p] : [];
  });
}

for (const arquivo of arquivos(SRC)) {
  const camada = relative(SRC, arquivo).split(/[\\/]/)[0];
  test(`camadas: ${relative(SRC, arquivo)}`, () => {
    const texto = readFileSync(arquivo, 'utf8');
    const imports = [...texto.matchAll(/(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const imp of imports) {
      assert.ok(imp.startsWith('.'), `${imp}: só imports relativos`);
      const alvo = relative(SRC, resolve(dirname(arquivo), imp)).split(/[\\/]/)[0];
      assert.ok(PERMITIDO[camada].includes(alvo), `${camada} não pode importar ${alvo} (${imp})`);
    }
    if (camada === 'dominio' || camada === 'aplicacao') {
      assert.ok(!/\b(document|window|fetch|localStorage)\b/.test(texto), 'domínio e aplicação não acessam navegador nem rede');
    }
  });
}
