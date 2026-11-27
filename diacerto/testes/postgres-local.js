// Executor de SQL para testes contra um Postgres local (psql), com a mesma interface do executor HTTP.
// Ative com DIACERTO_PG="host=127.0.0.1 port=5499 user=pgt".
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const literal = (v) => (v === null || v === undefined ? 'NULL'
  : `'${(typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/'/g, "''")}'`);
const substituir = (sql, params) => sql.replace(/\$(\d+)/g, (_, n) => literal(params[Number(n) - 1]));

export const conexaoTeste = process.env.DIACERTO_PG ?? null;

export function psql(banco, sql, extra = []) {
  return execFileSync('psql', [`${conexaoTeste} dbname=${banco}`, '-v', 'ON_ERROR_STOP=1', '-qAt', ...extra, '-c', sql], { encoding: 'utf8' });
}

export function prepararBanco(banco) {
  psql('postgres', `drop database if exists ${banco}`);
  psql('postgres', `create database ${banco}`);
  psql(banco, 'create schema neon_auth; create table neon_auth."user" (id text primary key, email text, banned boolean)');
  for (const arq of ['001_esquema.sql', '002_carga_ficticia.sql']) {
    execFileSync('psql', [`${conexaoTeste} dbname=${banco}`, '-v', 'ON_ERROR_STOP=1', '-q', '-f', new URL(`../banco/projeto-diacerto/${arq}`, import.meta.url).pathname]);
  }
}

export function executorPsql(banco) {
  return {
    async consultar(sql, params = []) {
      return JSON.parse(psql(banco, `select coalesce(json_agg(t), '[]'::json)::text from (${substituir(sql, params)}) t`).trim());
    },
    async executar(sql, params = []) { psql(banco, substituir(sql, params)); },
  };
}

export { readFileSync };
