# Autenticação

## O que está implementado

- **Login por e-mail e senha** (`/login`), com o e-mail comparado sem diferenciar maiúsculas.
- **Senhas com hash bcrypt** (custo 12), em `lib/auth/password.ts`. A senha nunca é gravada nem registrada em log.
- **Sessões no banco** (`sessions`): o navegador recebe um token aleatório de 32 bytes num cookie `fm_session`, e o banco guarda apenas o **hash SHA-256** desse token. Validade de 7 dias; sessões vencidas são limpas a cada novo login.
- **Cookie** `httpOnly`, `SameSite=Lax` e `Secure` em produção (pode ser desligado com `COOKIE_SECURE=false` apenas para testes locais sem HTTPS).
- **Limite de tentativas:** 5 erros por e-mail bloqueiam novas tentativas por 15 minutos (contagem em memória, por instância).
- **Tempo de resposta constante:** quando o e-mail não existe, uma comparação de senha é feita mesmo assim, para não revelar quais e-mails estão cadastrados.
- **Bloqueios:** usuário desativado ou academia suspensa não entram, e sessões já abertas deixam de valer.
- **Troca de senha** em Configurações, com a senha atual.
- **Cadastro do aluno pelo convite** (`/convite/{token}`): nome e sobrenome, telefone com DDD, e-mail, data de nascimento (18 anos ou mais), senha com confirmação e concordância com o uso dos dados pela academia. A conta nasce com perfil `STUDENT` e já entra logada, vendo o aviso de análise. Há limite de 10 cadastros por hora por conexão.
- **Conta de aluno sem convite** (`/criar-conta`): mesmos campos e regras do convite, com o consentimento para "as academias que me adicionarem". A conta nasce `STUDENT` sem vínculo; o administrador de uma academia a adiciona pelo e-mail em Solicitações, e ela passa pela mesma aprovação do convite.
- **Academias** não se cadastram sozinhas: o administrador da plataforma cria em `/plataforma` a academia e o responsável (`ACADEMY_ADMIN`). A senha inicial é aleatória e desconhecida; o responsável recebe um link de acesso (mesmo mecanismo da recuperação de senha, válido por 72 horas e de uso único) e cria a própria senha.
- **Destino após o login:** administrador da academia vai para `/`, administrador da plataforma para `/plataforma` e aluno para `/aluno`. Quem entra a partir de um convite volta para ele.
- **Proteção das páginas e ações:** toda página da área logada e toda Server Action chamam `requireAcademyAdmin()` ou `requirePlatformAdmin()` (`lib/auth/guards.ts`) antes de qualquer outra coisa. O layout não é a única barreira.
- As Server Actions do Next.js já verificam a origem das requisições, o que protege contra CSRF.

## Recuperação de senha

- Em **Esqueci minha senha** (`/esqueci-senha`), a pessoa informa o e-mail. A resposta é sempre a mesma, tenha a conta ou não.
- O link (`/redefinir-senha/{token}`) usa um token aleatório de 32 bytes; o banco guarda só o hash (`password_resets`). Vale 30 minutos e uma única vez; um pedido novo invalida os anteriores.
- Limites: 3 pedidos por hora por e-mail e 10 por conexão.
- Ao redefinir, todas as sessões da conta são encerradas. A página do link não envia o endereço para outros sites (`no-referrer`).
- **Envio:** Resend ou SMTP (Gmail, Outlook, e-mail do domínio...), escolhidos pelas variáveis do `.env`. Sem configuração, os e-mails aparecem no console do servidor e, com `EMAIL_OUTBOX_DIR`, também como arquivos. Guia completo em [email.md](email.md).

## O que ainda não existe

- Autenticação em dois fatores.
- Confirmação de e-mail no cadastro pelo convite (a aprovação do administrador é a barreira no MVP).
- Limite de tentativas compartilhado entre várias instâncias (exigiria Redis ou tabela própria).
