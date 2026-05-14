CREATE TYPE "public"."collaborator_role" AS ENUM('editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."recipe_activity_action" AS ENUM('created', 'edited', 'status_changed', 'shared', 'link_rotated', 'link_disabled', 'collaborator_added', 'collaborator_role_changed', 'collaborator_removed', 'imported_from_pdf', 'imported_from_file', 'duplicated');--> statement-breakpoint
CREATE TABLE "recipe_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipeId" integer NOT NULL,
	"actorUserId" integer NOT NULL,
	"action" "recipe_activity_action" NOT NULL,
	"payload" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_collaborators" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipeId" integer NOT NULL,
	"userId" integer NOT NULL,
	"role" "collaborator_role" NOT NULL,
	"addedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"addedByUserId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_share_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipeId" integer NOT NULL,
	"token" varchar(64) NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdByUserId" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"revokedAt" timestamp with time zone,
	CONSTRAINT "recipe_share_links_recipeId_unique" UNIQUE("recipeId"),
	CONSTRAINT "recipe_share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "updatedByUserId" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_collaborators_recipe_user_unique" ON "recipe_collaborators" USING btree ("recipeId","userId");