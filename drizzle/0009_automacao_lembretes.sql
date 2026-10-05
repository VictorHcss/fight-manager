CREATE TABLE "fee_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fee_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"sent_to" varchar(160) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "auto_generate_fees" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "reminder_days_before" integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "overdue_reminder" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_reminders" ADD CONSTRAINT "fee_reminders_fee_id_fees_id_fk" FOREIGN KEY ("fee_id") REFERENCES "public"."fees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fee_reminders_fee_kind" ON "fee_reminders" USING btree ("fee_id","kind");