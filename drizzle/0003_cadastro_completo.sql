CREATE TABLE "guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"cpf" varchar(14),
	"phone" varchar(20) NOT NULL,
	"email" varchar(160),
	"zip" varchar(9),
	"street" varchar(120),
	"number" varchar(20),
	"complement" varchar(60),
	"district" varchar(60),
	"city" varchar(80),
	"state" varchar(2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modalities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" uuid NOT NULL,
	"name" varchar(60) NOT NULL,
	"default_fee_cents" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_guardians" (
	"student_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"relationship" varchar(40) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_guardians_student_id_guardian_id_pk" PRIMARY KEY("student_id","guardian_id")
);
--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "document" varchar(18);--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "email" varchar(160);--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "zip" varchar(9);--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "street" varchar(120);--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "number" varchar(20);--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "complement" varchar(60);--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "district" varchar(60);--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "city" varchar(80);--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "state" varchar(2);--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "enrollment_terms" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "modality_id" uuid;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "cpf" varchar(14);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "zip" varchar(9);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "street" varchar(120);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "number" varchar(20);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "complement" varchar(60);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "district" varchar(60);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "city" varchar(80);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "state" varchar(2);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "emergency_name" varchar(120);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "emergency_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "emergency_relation" varchar(40);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "image_consent" boolean;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "image_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "health_notes" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "health_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "enrollment_signed_at" date;--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modalities" ADD CONSTRAINT "modalities_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guardians_academy_name_idx" ON "guardians" USING btree ("academy_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "modalities_academy_name_unique" ON "modalities" USING btree ("academy_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "student_guardians_one_primary" ON "student_guardians" USING btree ("student_id") WHERE "student_guardians"."is_primary";--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_modality_id_modalities_id_fk" FOREIGN KEY ("modality_id") REFERENCES "public"."modalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- Dados existentes: cada texto de modalidade vira uma modalidade da academia (sem diferenciar maiúsculas)
INSERT INTO "modalities" ("academy_id", "name")
SELECT DISTINCT ON (s."academy_id", lower(trim(s."modality"))) s."academy_id", trim(s."modality")
FROM "students" s
WHERE s."modality" IS NOT NULL AND trim(s."modality") <> ''
ORDER BY s."academy_id", lower(trim(s."modality")), s."created_at";--> statement-breakpoint
UPDATE "students" s SET "modality_id" = m."id"
FROM "modalities" m
WHERE m."academy_id" = s."academy_id" AND lower(m."name") = lower(trim(s."modality"));
