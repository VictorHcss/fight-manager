ALTER TYPE "public"."student_status" ADD VALUE 'pending';--> statement-breakpoint
ALTER TYPE "public"."student_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TYPE "public"."student_status" ADD VALUE 'suspended';--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" uuid NOT NULL,
	"token" varchar(40) NOT NULL,
	"label" varchar(80) DEFAULT 'Convite geral' NOT NULL,
	"expires_at" timestamp with time zone,
	"max_uses" integer,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "modality" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "joined_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "monthly_fee_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "invite_id" uuid;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "decided_by" uuid;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "rejection_reason" varchar(200);--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invites_academy_idx" ON "invites" USING btree ("academy_id");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_invite_id_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "students_user_academy_unique" ON "students" USING btree ("user_id","academy_id") WHERE "students"."user_id" is not null;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "student_id";--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_complete_when_approved" CHECK ("students"."status"::text in ('pending', 'rejected') or ("students"."modality" is not null and "students"."joined_at" is not null and "students"."monthly_fee_cents" is not null));