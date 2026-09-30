# Problemas comuns

**"DATABASE_URL não configurada"**: crie o `.env` a partir do `.env.example` (sem Docker) ou confira o `docker-compose.yml`.

**A aplicação não conecta ao banco no Docker**: o host do banco dentro do Compose é `db`, não `localhost`. Veja o estado com `docker compose ps` e os logs com `docker compose logs db`.

**Login não funciona no build de produção sem HTTPS**: em produção o cookie de sessão é `Secure`. No `docker compose` local isso já vem desligado (`COOKIE_SECURE=false`). Não desligue em um servidor público.

**"Muitas tentativas"**: espere 15 minutos ou reinicie o servidor (a contagem fica em memória).

**A porta 5432 está em uso**: outro PostgreSQL está rodando. Pare-o ou troque a porta publicada no `docker-compose.yml`.

**Os testes apagaram meus dados**: `TEST_DATABASE_URL` precisa apontar para um banco separado (`fight_manager_test`). Os testes recriam esse banco do zero a cada execução.

**Mensalidade não aparece como atrasada no dia do vencimento**: é o comportamento esperado. Ela só fica atrasada a partir do dia seguinte, no horário de Brasília.

**Não consigo editar uma mensalidade**: ela já recebeu pagamento. Cancele o pagamento primeiro.

## Limitações conhecidas

- Páginas de registro inexistente (ou de outra academia) mostram a mensagem de "não encontrado", mas respondem com status HTTP 200 em vez de 404, por causa do carregamento em streaming do Next.js. Nenhum dado é exibido.
- Não há paginação: as listas mostram até 100 ou 200 registros e os filtros encontram os demais.
- A execução com Docker foi preparada, mas **não foi testada no ambiente em que o projeto foi desenvolvido** (sem Docker disponível). Migrations, testes e build de produção foram verificados contra um PostgreSQL real fora de container.
