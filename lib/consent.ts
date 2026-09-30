/**
 * Texto do consentimento do cadastro pelo convite. O texto exato aceito fica guardado
 * junto com a data: se ele mudar no futuro, cada aluno continua com a versão que aceitou.
 */
export const consentText = (academy: string) =>
  `Concordo que a ${academy} use meus dados (nome, telefone, e-mail e data de nascimento) para a minha matrícula, mensalidades e contato.`;

/**
 * Consentimento da conta de aluno criada sem convite (tela "Criar conta"). Ainda não há
 * academia: o aluno autoriza que as academias que o adicionarem usem os dados da conta.
 */
export const accountConsentText = () =>
  "Concordo que as academias que me adicionarem como aluno usem meus dados (nome, telefone, e-mail e data de nascimento) para a minha matrícula, mensalidades e contato.";
