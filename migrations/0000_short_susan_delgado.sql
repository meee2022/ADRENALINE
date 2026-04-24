CREATE TABLE "addons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price" integer,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"phone" varchar(20) NOT NULL,
	"gender" varchar(10) NOT NULL,
	"delivery_time" varchar(20) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"address" text,
	"goals" text,
	"allergies" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"customer_id" varchar NOT NULL,
	"delivery_time" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"items" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category_id" varchar NOT NULL,
	"calories" integer,
	"macros" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"tags" text[]
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" varchar(20) DEFAULT 'ADMIN' NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_meal_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."meal_categories"("id") ON DELETE no action ON UPDATE no action;