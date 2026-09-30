# Configurar o envio de e-mails

O Fight Manager envia e-mails em quatro situações:

| E-mail | Quando | Para quem |
|---|---|---|
| Link de acesso da academia | O administrador da plataforma cria uma academia, ou gera um novo link | Responsável pela academia |
| Recuperação de senha | Alguém usa "Esqueci minha senha" | Dono da conta |
| Convite por e-mail | A academia envia o convite em "Convidar alunos" | Futuro aluno |
| Teste | `npm run email:test -- destino@email.com` | Quem você escolher |

Sem configuração, **nenhum e-mail é enviado**: as mensagens aparecem no console do servidor (no Docker, em `docker compose logs app`). Isso basta para desenvolver, mas não para uso real. Em especial, sem e-mail o responsável por uma academia nova não recebe o link de acesso, e a plataforma precisa copiar o link da tela e enviar por outro meio.

Todos os e-mails saem em texto e em HTML simples, com os links clicáveis.

## Resumo rápido

1. Escolha a forma de envio: **SMTP** (a mais fácil para começar, serve Gmail, Outlook ou o e-mail do seu domínio) ou **Resend** (melhor entrega em produção, exige domínio próprio).
2. Preencha as variáveis no `.env`, como nos exemplos abaixo.
3. Reinicie a aplicação (`npm run dev` de novo, ou `docker compose up -d` no Docker).
4. Teste: `npm run email:test -- seu@email.com`. No Docker: `docker compose exec app npm run email:test -- seu@email.com`.

## Variáveis

| Variável | Para que serve | Exemplo |
|---|---|---|
| `EMAIL_PROVIDER` | `smtp`, `resend` ou `console`. Vazio: escolhe sozinho (Resend se houver `RESEND_API_KEY`, senão SMTP se houver `SMTP_HOST`, senão console) | `smtp` |
| `EMAIL_FROM` | Remetente que aparece para quem recebe. Precisa ser um endereço que o serviço autoriza você a usar | `Academia Punho de Ferro <nao-responda@punhodeferro.com.br>` |
| `RESEND_API_KEY` | Chave da API do Resend | `re_123...` |
| `SMTP_HOST` | Servidor SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | Porta. Use 587 (STARTTLS) ou 465 (SSL) | `587` |
| `SMTP_SECURE` | `true` na porta 465; `false` na 587. Vazio: decide pela porta | `false` |
| `SMTP_USER` | Usuário do SMTP (quase sempre o e-mail) | `contato@punhodeferro.com.br` |
| `SMTP_PASS` | Senha do SMTP ou senha de app | `abcd efgh ijkl mnop` |
| `EMAIL_OUTBOX_DIR` | Só desenvolvimento: grava cada e-mail como `.json` nesta pasta | `.outbox` |

As variáveis ficam no `.env`, que não vai para o Git. Nunca coloque senhas ou chaves no código. No Docker Compose, o `docker-compose.yml` já repassa todas elas do `.env` para a aplicação.

## Opção 1: SMTP

Serve para qualquer provedor que ofereça SMTP. Para começar ou para pouco volume (dezenas de e-mails por dia), é o caminho mais simples.

### Gmail

O Gmail não aceita a senha normal da conta por SMTP. É preciso uma **senha de app**:

1. Ative a verificação em duas etapas na Conta Google (Segurança → Verificação em duas etapas).
2. Em Segurança → Senhas de app, crie uma senha para "Fight Manager". O Google mostra 16 letras; copie.
3. No `.env`:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=suaacademia@gmail.com
SMTP_PASS=abcdefghijklmnop
EMAIL_FROM=Academia Punho de Ferro <suaacademia@gmail.com>
```

No Gmail, o `EMAIL_FROM` precisa ser o próprio endereço (ou um alias configurado nele). Contas gratuitas têm limite diário de envio (em torno de 500 mensagens), suficiente para uma academia.

### Outlook / Microsoft 365

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=contato@suaacademia.com.br
SMTP_PASS=sua-senha-ou-senha-de-app
EMAIL_FROM=Academia Punho de Ferro <contato@suaacademia.com.br>
```

No Microsoft 365, o administrador pode precisar liberar o "SMTP autenticado" para a caixa. Contas com verificação em duas etapas usam senha de app. Contas pessoais (outlook.com, hotmail.com) usam `smtp-mail.outlook.com`, mas a Microsoft vem restringindo SMTP nessas contas. Para uso real, prefira o e-mail do seu domínio ou o Resend.

### E-mail do seu domínio (Hostinger, Locaweb, KingHost, HostGator, cPanel...)

O painel da hospedagem mostra servidor, porta e usuário na página da conta de e-mail. Alguns valores comuns (confira no seu painel, porque mudam com o tempo):

| Provedor | Servidor | Porta |
|---|---|---|
| Hostinger | `smtp.hostinger.com` | 465 (SSL) |
| Locaweb | `email-ssl.com.br` | 465 (SSL) |
| KingHost | `smtp.kinghost.net` | 587 |
| cPanel em geral | `mail.seudominio.com.br` | 465 (SSL) ou 587 |

Exemplo com porta 465:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=nao-responda@suaacademia.com.br
SMTP_PASS=senha-da-caixa
EMAIL_FROM=Academia Punho de Ferro <nao-responda@suaacademia.com.br>
```

Crie uma caixa só para o sistema (por exemplo `nao-responda@`). Assim a senha do e-mail principal não fica no servidor.

### Serviços de envio com SMTP (Brevo, Amazon SES, Mailgun, SendGrid)

Todos oferecem SMTP, além da API. Crie a conta, verifique o domínio (veja "Não cair no spam", abaixo), gere as credenciais SMTP no painel e preencha as mesmas cinco variáveis. Exemplo com o Brevo:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-login-smtp-do-brevo
SMTP_PASS=sua-chave-smtp-do-brevo
EMAIL_FROM=Academia Punho de Ferro <nao-responda@suaacademia.com.br>
```

## Opção 2: Resend

O Resend envia por uma chamada HTTP (sem SMTP). É a opção recomendada para produção com domínio próprio.

1. Crie uma conta em https://resend.com.
2. Em **Domains**, adicione o seu domínio (por exemplo `suaacademia.com.br`) e crie no DNS os registros que o Resend mostrar (SPF, DKIM e, de preferência, DMARC). A verificação costuma levar de minutos a algumas horas.
3. Em **API Keys**, crie uma chave com permissão de envio.
4. No `.env`:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_sua_chave
EMAIL_FROM=Academia Punho de Ferro <nao-responda@suaacademia.com.br>
```

O `EMAIL_FROM` precisa usar o domínio verificado. Sem domínio verificado, o Resend só entrega para o e-mail da sua própria conta, o que serve apenas para testes.

## Não cair no spam

Para e-mails de um domínio próprio, três registros no DNS fazem toda a diferença. O serviço de envio (Resend, Brevo, SES, sua hospedagem) mostra os valores exatos; você só cria os registros no painel onde o domínio está (Registro.br, Cloudflare, Hostinger...).

- **SPF** (registro TXT no domínio): diz quais servidores podem enviar pelo seu domínio. Exemplo: `v=spf1 include:_spf.resend.com ~all`. Tenha **um único** registro SPF; se já existir um, acrescente o `include:` nele em vez de criar outro.
- **DKIM** (registro TXT ou CNAME): assinatura que prova que a mensagem não foi alterada. O serviço gera a chave.
- **DMARC** (registro TXT em `_dmarc.seudominio.com.br`): diz o que fazer com mensagens que falham nas verificações. Para começar: `v=DMARC1; p=none; rua=mailto:voce@seudominio.com.br`.

Outras boas práticas:

- Use um remetente do mesmo domínio verificado. Um remetente `@gmail.com` enviado por outro serviço quase sempre cai no spam.
- Mantenha um nome reconhecível no remetente, como o nome da academia.
- Depois de configurar, envie um teste para um Gmail e confira em "Mostrar original" se SPF, DKIM e DMARC aparecem como `PASS`.

## Testar a configuração

```bash
npm run email:test -- seu@email.com
# no Docker:
docker compose exec app npm run email:test -- seu@email.com
```

O comando mostra a forma de envio ativa, o remetente e o servidor, e envia uma mensagem de verdade. Se algo falhar, ele mostra o erro completo do serviço. Na aplicação, uma falha de envio não interrompe a ação principal: a academia é criada e o pedido de senha é registrado, e o erro vai para o log do servidor. Por isso, teste antes de colocar em uso.

## Em desenvolvimento

Sem configurar nada, os e-mails aparecem no terminal de `npm run dev`:

```text
[e-mail de desenvolvimento] para admin@academia.dev
Assunto: Redefinir sua senha no Fight Manager
...
```

Para guardar cada e-mail como arquivo, use `EMAIL_OUTBOX_DIR=.outbox`. Para ver os e-mails numa caixa de entrada falsa, com HTML, rode um servidor de teste como o Mailpit (`docker run -p 1025:1025 -p 8025:8025 axllent/mailpit`) e configure:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
```

As mensagens aparecem em http://localhost:8025. No Docker Compose, use o nome do serviço do Mailpit no lugar de `localhost`.

## Problemas comuns

| Mensagem ou sintoma | Causa provável | O que fazer |
|---|---|---|
| `Invalid login: 535` | Usuário ou senha do SMTP errados | No Gmail e no Outlook, use senha de app. Confira se `SMTP_USER` é o e-mail completo |
| `Greeting never received` ou `Connection timeout` | Porta bloqueada ou `SMTP_SECURE` trocado | Porta 465 pede `SMTP_SECURE=true`; porta 587 pede `false`. Alguns provedores de nuvem bloqueiam a porta 25 e às vezes a 587: tente a 465 |
| `wrong version number` / `SSL routines` | `SMTP_SECURE=true` na porta 587 | Use `SMTP_SECURE=false` na 587 |
| `self-signed certificate` | Servidor da hospedagem com certificado próprio | Use o nome de servidor que o provedor indica (normalmente com o certificado certo) |
| `Resend respondeu 403` | Domínio não verificado ou `EMAIL_FROM` de outro domínio | Termine a verificação do domínio e use um remetente dele |
| `Resend respondeu 422` | `EMAIL_FROM` mal formatado | Use `Nome <email@dominio>` |
| O teste funciona, mas o e-mail não chega | Caiu no spam | Configure SPF, DKIM e DMARC (veja acima) |
| Nada acontece e o log mostra `[e-mail de desenvolvimento]` | Nenhuma forma de envio configurada | Preencha o `.env` e reinicie a aplicação |
| No Docker, o `.env` foi alterado e nada mudou | O contêiner não foi recriado | `docker compose up -d` (recria com as novas variáveis) |

## Onde está o código

- `lib/email/index.ts`: escolha da forma de envio, Resend, SMTP e o HTML dos e-mails.
- `scripts/email-test.ts`: o comando `npm run email:test`.
- Textos dos e-mails: `services/accounts.ts` (acesso da academia), `services/password-reset.ts` (senha) e `services/invites.ts` (convite).
- Testes: os testes automatizados trocam o envio por uma caixa em memória (`useMailer(memoryMailer())`), então nunca enviam e-mails de verdade.
