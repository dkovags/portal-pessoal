// Inicializador da função "api" (Neon Functions). Baixa o código do DiaCerto do GitHub,
// fixado num commit (CODIGO_VERSAO), e entrega as requisições à API em camadas.
// Atualizar o servidor = trocar CODIGO_VERSAO, sem reenviar este arquivo.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = process.env.CODIGO_BASE || 'https://raw.githubusercontent.com/dkovags/portal-pessoal';
const VERSAO = process.env.CODIGO_VERSAO;
let pronto = null;

async function carregar() {
  if (!/^[0-9a-f]{40}$/.test(VERSAO || '')) throw new Error('CODIGO_VERSAO deve ser o SHA completo de um commit.');
  const raiz = `${BASE}/${VERSAO}/diacerto/`;
  const baixar = async (arq) => {
    const r = await fetch(raiz + arq);
    if (!r.ok) throw new Error(`não baixou ${arq}: ${r.status}`);
    return r.text();
  };
  const manifesto = JSON.parse(await baixar('servidor/arquivos.json'));
  const destino = join('/tmp', `diacerto-${VERSAO}`);
  await mkdir(destino, { recursive: true });
  await writeFile(join(destino, 'package.json'), '{"type":"module"}');
  await Promise.all(manifesto.arquivos.map(async (arq) => {
    if (!/^src\/[a-z0-9/_-]+\.js$/.test(arq)) throw new Error(`caminho inesperado: ${arq}`);
    const conteudo = await baixar(arq);
    await mkdir(dirname(join(destino, arq)), { recursive: true });
    await writeFile(join(destino, arq), conteudo);
  }));
  const modulo = await import(pathToFileURL(join(destino, manifesto.entrada)).href);
  return modulo.criarHandler(process.env);
}

export default {
  async fetch(request) {
    pronto ??= carregar().catch((e) => { pronto = null; throw e; });
    try {
      return await (await pronto).fetch(request);
    } catch (e) {
      console.error(e);
      const origem = request.headers.get('origin') || '*';
      return new Response(JSON.stringify({ erro: { codigo: 'INICIO', mensagem: 'O servidor está iniciando ou indisponível. Tente de novo em instantes.' } }),
        { status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origem, 'Access-Control-Allow-Headers': 'authorization, content-type' } });
    }
  },
};
