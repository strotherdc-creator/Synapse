CREATE TABLE "module_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_id" integer NOT NULL,
	"step_number" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"ai_prompt" text NOT NULL,
	"answer_key" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "step_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"step_id" integer NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_step_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"module_id" integer NOT NULL,
	"step_id" integer NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"final_answer" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
