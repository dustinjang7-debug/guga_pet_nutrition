CREATE TABLE "recipe_activity_seen" (
	"userId" integer NOT NULL,
	"recipeId" integer NOT NULL,
	"lastSeenAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_activity_seen_user_recipe_unique" ON "recipe_activity_seen" USING btree ("userId","recipeId");