/**
 * Log Stats settings + custom stats — idempotent, additive migrations.
 * Only CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
 * Never drops, rewrites, or deletes existing stats rows. Safe on every startup.
 */
export const WWLD_STATS_MIGRATIONS: string[] = [
  // NULL on existing rows = logged before per-doctor settings (all built-in stats tracked)
  `ALTER TABLE wwld_sessions ADD COLUMN IF NOT EXISTS tracked_stats TEXT`,
  `CREATE TABLE IF NOT EXISTS wwld_stat_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    hidden_builtin_stats TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS wwld_custom_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(60) NOT NULL,
    unit VARCHAR(20),
    value_type VARCHAR(20) NOT NULL DEFAULT 'number',
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS wwld_custom_stat_values (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    custom_stat_id INTEGER NOT NULL,
    session_date VARCHAR(10) NOT NULL,
    session_type VARCHAR(20) NOT NULL,
    value INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, custom_stat_id, session_date, session_type)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_wwld_custom_stats_user ON wwld_custom_stats(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_wwld_custom_stat_values_user_date ON wwld_custom_stat_values(user_id, session_date)`,
];
