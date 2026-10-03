/**
 * Goals page — idempotent, additive migrations (safe on every startup).
 * Only CREATE TABLE IF NOT EXISTS. Touches no existing table or row.
 */
export const GOALS_MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS doctor_goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    goal_year INTEGER NOT NULL,
    yearly_revenue INTEGER,
    yearly_office_visits INTEGER,
    yearly_new_patients INTEGER,
    weeks_worked INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    CONSTRAINT doctor_goals_user_year_key UNIQUE (user_id, goal_year)
  )`,
];
