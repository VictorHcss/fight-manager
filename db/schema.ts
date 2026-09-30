/**
 * Schema do banco (Drizzle ORM + PostgreSQL).
 *
 * Multi-academia desde a base: toda tabela de dados de negócio tem academy_id,
 * e a camada de serviços sempre filtra por ele (ver services/context.ts).
 * Dinheiro sempre em centavos (integer), nunca em ponto flutuante.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean, check, date, index, primaryKey, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar, type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["PLATFORM_ADMIN", "ACADEMY_ADMIN", "STUDENT"]);
// pending = pediu para entrar pelo convite; rejected = pedido recusado (fica no histórico).
// suspended está reservado para o futuro. Só "active" gera mensalidades e dá acesso à área do aluno.
export const studentStatus = pgEnum("student_status", ["active", "inactive", "pending", "rejected", "suspended"]);
// "atrasado" NÃO é armazenado: é calculado (pendente + vencimento no passado)
export const feeStatus = pgEnum("fee_status", ["pending", "paid", "canceled"]);
export const paymentStatus = pgEnum("payment_status", ["paid", "pending", "canceled"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "pix", "debit", "credit", "other"]);
export const entryType = pgEnum("entry_type", ["income", "expense"]);
export const entryStatus = pgEnum("entry_status", ["active", "canceled"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
};

/** Endereço estruturado (usado na academia, no aluno e no responsável; sai na ficha). */
const address = {
  zip: varchar("zip", { length: 9 }),
  street: varchar("street", { length: 120 }),
  number: varchar("number", { length: 20 }),
  complement: varchar("complement", { length: 60 }),
  district: varchar("district", { length: 60 }),
  city: varchar("city", { length: 80 }),
  state: varchar("state", { length: 2 }),
};

export const academies = pgTable("academies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  active: boolean("active").notNull().default(true),
  document: varchar("document", { length: 18 }), // CPF ou CNPJ, se a academia usar na ficha
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 160 }),
  ...address,
  enrollmentTerms: text("enrollment_terms"), // termos escritos pela academia, impressos na ficha
  ...timestamps,
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // null para PLATFORM_ADMIN e STUDENT (o aluno se liga às academias por students.user_id)
  academyId: uuid("academy_id").references(() => academies.id, { onDelete: "cascade" }),
  role: userRole("role").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  // conta de aluno criada sem convite: consentimento dado no cadastro (LGPD), copiado para cada
  // vínculo quando o administrador de uma academia adiciona o aluno pelo e-mail da conta
  // telefone e nascimento informados no cadastro sem convite (copiados para o vínculo com a academia)
  phone: varchar("phone", { length: 20 }),
  birthDate: date("birth_date"),
  dataConsentAt: timestamp("data_consent_at", { withTimezone: true }),
  dataConsentText: text("data_consent_text"),
  ...timestamps,
}, (t) => [uniqueIndex("users_email_unique").on(sql`lower(${t.email})`)]);

/** Pedidos de redefinição de senha: só o hash do token fica no banco; cada link vale uma vez e por pouco tempo. */
export const passwordResets = pgTable("password_resets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("password_resets_user_idx").on(t.userId)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(), // só o hash do token fica no banco
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Convites de entrada. O QR Code leva só o token; o servidor descobre a academia.
 * Validade, limite de usos e rótulo já existem para evoluir (convites por turma, individuais...).
 */
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 40 }).notNull().unique(),
  label: varchar("label", { length: 80 }).notNull().default("Convite geral"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  maxUses: integer("max_uses"),
  usesCount: integer("uses_count").notNull().default(0),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("invites_academy_idx").on(t.academyId)]);

/** Modalidades oferecidas por cada academia. Não são apagadas: desativar tira das listas. */
export const modalities = pgTable("modalities", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 60 }).notNull(),
  defaultFeeCents: integer("default_fee_cents"), // sugerido no cadastro do aluno
  active: boolean("active").notNull().default(true),
  ...timestamps,
}, (t) => [uniqueIndex("modalities_academy_name_unique").on(t.academyId, sql`lower(${t.name})`)]);

/**
 * O "aluno" é o vínculo de uma pessoa com uma academia: guarda os dados da academia
 * (modalidade, mensalidade, status). A conta de acesso, quando existe, fica em users (user_id).
 */
export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  inviteId: uuid("invite_id").references(() => invites.id, { onDelete: "set null" }),
  name: varchar("name", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 160 }),
  birthDate: date("birth_date"),
  // dados da academia: vazios enquanto o pedido está pendente, preenchidos na aprovação
  modalityId: uuid("modality_id").references(() => modalities.id, { onDelete: "restrict" }),
  joinedAt: date("joined_at"),
  status: studentStatus("status").notNull().default("active"),
  monthlyFeeCents: integer("monthly_fee_cents"),
  dueDay: integer("due_day").notNull().default(10), // dia de vencimento padrão
  notes: text("notes"),
  cpf: varchar("cpf", { length: 14 }),
  ...address,
  emergencyName: varchar("emergency_name", { length: 120 }),
  emergencyPhone: varchar("emergency_phone", { length: 20 }),
  emergencyRelation: varchar("emergency_relation", { length: 40 }),
  imageConsent: boolean("image_consent"), // null = ainda não perguntado
  imageConsentAt: timestamp("image_consent_at", { withTimezone: true }),
  // dado sensível (LGPD): só aparece na seção restrita do perfil e só com consentimento
  healthNotes: text("health_notes"),
  healthConsentAt: timestamp("health_consent_at", { withTimezone: true }),
  enrollmentSignedAt: date("enrollment_signed_at"), // ficha de matrícula assinada
  // consentimento dado no cadastro pelo convite (LGPD): quando e qual texto foi aceito
  dataConsentAt: timestamp("data_consent_at", { withTimezone: true }),
  dataConsentText: text("data_consent_text"),
  // direito de eliminação (LGPD): dados pessoais apagados, financeiro mantido de forma anônima
  anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: uuid("decided_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  rejectionReason: varchar("rejection_reason", { length: 200 }),
  // vínculo encerrado (hoje: pedido recusado). Fica no histórico e não bloqueia um novo pedido.
  closedAt: timestamp("closed_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  // aluno aprovado (ou inativo) sempre tem os dados da academia completos
  check("students_complete_when_approved", sql`${t.status}::text in ('pending', 'rejected') or (${t.modalityId} is not null and ${t.joinedAt} is not null and ${t.monthlyFeeCents} is not null)`),
  // uma conta tem no máximo um vínculo em aberto por academia (vínculos encerrados não contam)
  uniqueIndex("students_user_academy_unique").on(t.userId, t.academyId).where(sql`${t.userId} is not null and ${t.closedAt} is null`),
  index("students_academy_status_idx").on(t.academyId, t.status),
  index("students_academy_name_idx").on(t.academyId, sql`lower(${t.name})`),
  index("students_academy_phone_idx").on(t.academyId, t.phone),
]);

/**
 * Responsável legal de alunos menores. É um cadastro da academia, ligado a um ou mais
 * alunos (irmãos compartilham o mesmo responsável). O principal é o contato de cobrança.
 */
export const guardians = pgTable("guardians", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  cpf: varchar("cpf", { length: 14 }),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 160 }),
  ...address,
  ...timestamps,
}, (t) => [index("guardians_academy_name_idx").on(t.academyId, sql`lower(${t.name})`)]);

export const studentGuardians = pgTable("student_guardians", {
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  guardianId: uuid("guardian_id").notNull().references(() => guardians.id, { onDelete: "restrict" }),
  relationship: varchar("relationship", { length: 40 }).notNull(), // mãe, pai, avó, tutor...
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.studentId, t.guardianId] }),
  uniqueIndex("student_guardians_one_primary").on(t.studentId).where(sql`${t.isPrimary}`), // no máximo um principal
]);

export const fees = pgTable("fees", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "restrict" }),
  amountCents: integer("amount_cents").notNull(),
  dueDate: date("due_date").notNull(),
  reference: varchar("reference", { length: 7 }).notNull(), // "2026-09"
  status: feeStatus("status").notNull().default("pending"),
  notes: text("notes"),
  ...timestamps,
}, (t) => [
  index("fees_academy_status_due_idx").on(t.academyId, t.status, t.dueDate),
  index("fees_student_idx").on(t.studentId),
  // uma mensalidade ativa por aluno e período (a geração em lote não duplica)
  uniqueIndex("fees_student_reference_unique").on(t.studentId, t.reference).where(sql`${t.status} <> 'canceled'`),
]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "restrict" }),
  feeId: uuid("fee_id").references(() => fees.id, { onDelete: "restrict" }),
  amountCents: integer("amount_cents").notNull(),
  paidAt: date("paid_at").notNull(),
  reference: varchar("reference", { length: 60 }),
  method: paymentMethod("method").notNull(),
  status: paymentStatus("status").notNull().default("paid"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  cancelReason: varchar("cancel_reason", { length: 200 }),
  ...timestamps,
}, (t) => [
  index("payments_academy_date_idx").on(t.academyId, t.paidAt),
  index("payments_fee_idx").on(t.feeId),
  index("payments_student_idx").on(t.studentId),
]);

export const financialEntries = pgTable("financial_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  type: entryType("type").notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  description: varchar("description", { length: 160 }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  date: date("date").notNull(),
  notes: text("notes"),
  status: entryStatus("status").notNull().default("active"),
  // entrada gerada automaticamente por um pagamento (uma por pagamento: impede contagem dupla)
  paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "restrict" }).unique(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (t) => [index("entries_academy_date_idx").on(t.academyId, t.date)]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").references(() => academies.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 60 }).notNull(), // ex.: payment.created
  entity: varchar("entity", { length: 40 }).notNull(),
  entityId: uuid("entity_id"),
  summary: varchar("summary", { length: 240 }).notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_academy_date_idx").on(t.academyId, t.createdAt)]);

export const studentsRelations = relations(students, ({ many }) => ({ fees: many(fees), payments: many(payments) }));
export const feesRelations = relations(fees, ({ one, many }) => ({
  student: one(students, { fields: [fees.studentId], references: [students.id] }),
  payments: many(payments),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  student: one(students, { fields: [payments.studentId], references: [students.id] }),
  fee: one(fees, { fields: [payments.feeId], references: [fees.id] }),
}));

export type User = typeof users.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type Modality = typeof modalities.$inferSelect;
export type Guardian = typeof guardians.$inferSelect;
export type Academy = typeof academies.$inferSelect;
export type Fee = typeof fees.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type FinancialEntry = typeof financialEntries.$inferSelect;
