import bcrypt from "bcryptjs";

const ROUNDS = 12;

export const hashPassword = (password: string) => bcrypt.hash(password, ROUNDS);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

/** Hash de verdade usado quando o e-mail não existe, para o tempo de resposta não revelar isso. */
let dummy: string | null = null;
export const dummyHash = () => (dummy ??= bcrypt.hashSync("senha-que-nao-existe", ROUNDS));
