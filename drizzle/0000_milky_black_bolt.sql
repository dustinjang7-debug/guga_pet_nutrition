CREATE TYPE "public"."feeding_mode" AS ENUM('normal', 'weight_loss');--> statement-breakpoint
CREATE TYPE "public"."recipe_status" AS ENUM('draft', 'approved');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."species" AS ENUM('dog', 'cat');--> statement-breakpoint
CREATE TYPE "public"."workflow" AS ENUM('wizard', 'simple', 'premix');--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"petName" varchar(100),
	"petId" varchar(64),
	"species" "species" NOT NULL,
	"lifeStage" varchar(64) NOT NULL,
	"bodyWeightKg" numeric(6, 2) NOT NULL,
	"lifeStageFactor" numeric(4, 2) NOT NULL,
	"feedingMode" "feeding_mode" DEFAULT 'normal' NOT NULL,
	"workflow" "workflow" DEFAULT 'simple' NOT NULL,
	"startingVolumeG" integer DEFAULT 1000 NOT NULL,
	"targetProteinPct" numeric(5, 2),
	"targetCarbPct" numeric(5, 2),
	"items" jsonb NOT NULL,
	"notes" text,
	"status" "recipe_status" DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
