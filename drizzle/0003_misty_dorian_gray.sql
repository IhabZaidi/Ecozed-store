ALTER TABLE "orders" ADD COLUMN "shipping" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "pricing_mode" text DEFAULT 'qty';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "offers" jsonb DEFAULT '[]'::jsonb;