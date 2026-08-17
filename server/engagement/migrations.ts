/**
 * Engagement system idempotent migrations.
 * These create new tables only — they never modify existing tables.
 * Safe to run on every server startup.
 */
export const ENGAGEMENT_MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS daily_growth_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    plan_date VARCHAR(10) NOT NULL,
    focus VARCHAR(100) NOT NULL,
    state VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, plan_date)
  )`,
  `CREATE TABLE IF NOT EXISTS growth_actions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    plan_id INTEGER,
    source VARCHAR(50) NOT NULL,
    source_ref VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    why_now TEXT,
    script TEXT,
    estimate_minutes INTEGER DEFAULT 5,
    pillar VARCHAR(100),
    sort_order INTEGER NOT NULL DEFAULT 0,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    action_date VARCHAR(10) NOT NULL,
    completed_at TIMESTAMP,
    deferred_to VARCHAR(10),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS growth_action_outcomes (
    id SERIAL PRIMARY KEY,
    action_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    outcome_type VARCHAR(50) NOT NULL,
    confidence INTEGER,
    note TEXT,
    completion_seconds INTEGER,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS user_engagement_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    timezone VARCHAR(50) DEFAULT 'America/Chicago',
    morning_anchor VARCHAR(5) DEFAULT '07:30',
    end_of_day_anchor VARCHAR(5) DEFAULT '17:00',
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_address VARCHAR(320),
    quiet_days VARCHAR(50) DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS engagement_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`,
  // Indexes for common queries
  `CREATE INDEX IF NOT EXISTS idx_growth_actions_user_date ON growth_actions(user_id, action_date)`,
  `CREATE INDEX IF NOT EXISTS idx_growth_actions_plan ON growth_actions(plan_id)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_growth_plans_user_date ON daily_growth_plans(user_id, plan_date)`,
  `CREATE INDEX IF NOT EXISTS idx_engagement_events_user ON engagement_events(user_id, created_at)`,
  // Add selectedTopicId column for quick-start topic selection
  `ALTER TABLE user_engagement_preferences ADD COLUMN IF NOT EXISTS selected_topic_id VARCHAR(50)`,
  // Practice profile fields on users table
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS practice_name TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(50)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_url TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(100)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok_handle VARCHAR(100)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS work_days VARCHAR(20) DEFAULT 'mon,tue,wed,thu,fri'`,
];
