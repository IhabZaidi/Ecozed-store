CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text DEFAULT '',
	"updated_at" timestamp DEFAULT now()
);
