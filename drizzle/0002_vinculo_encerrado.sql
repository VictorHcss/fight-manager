DROP INDEX "students_user_academy_unique";--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "students_user_academy_unique" ON "students" USING btree ("user_id","academy_id") WHERE "students"."user_id" is not null and "students"."closed_at" is null;