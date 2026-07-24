export const ENV = {
  // Clerk
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
  clerkPublishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "",

  // Database
  databaseUrl: process.env.DATABASE_URL ?? "",

  // AI — Gemini (primary)
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",

  // AI — Groq (fallback)
  groqApiKey: process.env.GROQ_API_KEY ?? "",

  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",

  // Admin
  adminEmail: process.env.ADMIN_EMAIL ?? "",

  // Backup email (SMTP) — used for weekly WWLD data backup
  // SMTP_USER: Gmail address used to send (e.g., yourapp@gmail.com)
  // SMTP_PASS: Gmail App Password (not your regular password)
  // BACKUP_EMAIL: where to send the backup (defaults to ADMIN_EMAIL)
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  backupEmail: process.env.BACKUP_EMAIL ?? process.env.ADMIN_EMAIL ?? "",

  // Runtime
  isProduction: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT || "3001"),
};
