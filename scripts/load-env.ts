/**
 * Carrega o .env da raiz quando os scripts rodam fora do Next (migrate, seed, create-admin).
 * O Next já lê o .env sozinho; aqui é preciso fazer isso antes de importar o banco.
 * Sem .env (por exemplo, no Docker, onde as variáveis vêm do compose), não faz nada.
 */
try {
  process.loadEnvFile(".env");
} catch {
  // sem arquivo .env: usa as variáveis de ambiente já definidas
}
