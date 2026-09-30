# Roadmap

Itens **não implementados**, em ordem sugerida. Nada aqui existe no sistema hoje.

## Antes do uso real
- Cabeçalhos de segurança (RNF04) e fuso horário por academia (RNF16).

## Próximos passos (curto prazo)
- Suspender e reativar academias pela tela da plataforma.
- Exportação do financeiro e das mensalidades em CSV.
- Status HTTP 404 correto nas páginas de registro não encontrado.

## Academia
- Permissões por função (ex.: recepção sem acesso ao financeiro).
- Controle de presença e check-in.
- Contratos e assinatura digital.
- Planos com valores por modalidade e descontos.
- Relatórios avançados (inadimplência por período, receita por modalidade).

## Próxima entrega (B)
- Convite para responsáveis: "Sou responsável por um aluno menor", com cadastro da conta do responsável, dos dados da criança e do consentimento.
- Área do responsável: ver situação, próximo pagamento e histórico de cada dependente.

## Academia
- Turmas: dias da semana, horários, professor e turma infantil (decidido deixar para quando houver controle de presença).

## Convites (a estrutura já existe; faltam as telas)
- Convites com validade e limite de usos definidos pelo administrador.
- Convites individuais (para uma pessoa). O envio do convite geral por e-mail já existe (v0.7).
- Convites por turma ou modalidade, já preenchendo a modalidade na aprovação.
- Histórico de convites e contagem de cadastros por convite.

## Aluno
- Novo pedido de entrada depois de uma recusa (a estrutura já permite; falta a tela).
- Confirmação de e-mail no cadastro pelo convite.
- Conta de responsável para alunos menores de idade.
- Edição dos próprios dados de contato e troca de senha na área do aluno.
- Recibo de pagamento na área do aluno.
- Notificações de vencimento (e-mail, WhatsApp).

## Plataforma (SaaS)
- Cadastro, ativação e suspensão de academias pelo painel.
- Planos, assinaturas e cobrança das academias.
- Acesso de suporte com liberação por academia e auditoria.
- Auditoria da plataforma e logs técnicos.
- Recorrência automática e integrações de pagamento (Pix, cartão).