# Publicação em produção

O `Dockerfile` gera uma imagem de produção que aplica as migrations pendentes e inicia o servidor na porta 3000.

## Checklist

1. **PostgreSQL gerenciado** (ou um container com volume persistente e backup automático).
2. **Variáveis:** `DATABASE_URL` apontando para o banco de produção, `APP_TIMEZONE=America/Sao_Paulo`. **Não defina `COOKIE_SECURE=false`.**
3. **HTTPS obrigatório** (o cookie de sessão é `Secure`). Use o HTTPS do provedor ou um proxy como Caddy ou Nginx.
4. **Primeiro acesso:** `ADMIN_PASSWORD="..." npm run db:create-admin -- "Academia" "Nome" email` dentro do container. **Não rode o seed em produção.**
5. **Backups diários** do banco. O histórico financeiro não pode ser recriado.
6. **E-mail:** para a recuperação de senha funcionar, crie uma conta no Resend, verifique o domínio (registros SPF e DKIM no DNS) e defina `RESEND_API_KEY` e `EMAIL_FROM`. Sem isso, os e-mails só aparecem no log do servidor.
7. **Uma instância** da aplicação, ou aceite que o limite de tentativas de login seja contado por instância.

## Exemplo com a própria imagem

```bash
docker build -t fight-manager .
docker run -d -p 3000:3000 -e DATABASE_URL="postgres://usuario:senha@host:5432/fight_manager" fight-manager
docker exec -it <container> sh -c 'ADMIN_PASSWORD="..." npm run db:create-admin -- "Academia" "Nome" email@dominio.com'
```

## Observações

- A imagem inclui as dependências de desenvolvimento, porque o `tsx` é usado pelos scripts de administração. Uma imagem mais enxuta (modo `standalone` do Next.js) fica como melhoria.
- Os logs de erro saem na saída padrão do container (`docker logs`).
- O sistema envia `noindex` para buscadores: é uma ferramenta interna.
