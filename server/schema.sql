-- NutriPlan Pro — PostgreSQL schema
-- Run once: psql -U postgres -d nutriplan -f schema.sql
-- Create DB first: createdb nutriplan

CREATE TABLE IF NOT EXISTS saved_diets (
  id            TEXT PRIMARY KEY,
  timestamp     BIGINT NOT NULL,
  patient_data  JSONB  NOT NULL,
  metrics       JSONB  NOT NULL,
  plan          JSONB  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_diets_timestamp ON saved_diets (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_saved_diets_patient_name ON saved_diets ((patient_data->>'name'));

CREATE TABLE IF NOT EXISTS custom_foods (
  id           TEXT    PRIMARY KEY,
  name         TEXT    NOT NULL,
  brand        TEXT,
  calories     REAL    NOT NULL DEFAULT 0,
  protein      REAL    NOT NULL DEFAULT 0,
  carbs        REAL    NOT NULL DEFAULT 0,
  fats         REAL    NOT NULL DEFAULT 0,
  portion_size REAL    NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS client_progress (
  client_name  TEXT  PRIMARY KEY,
  entries      JSONB NOT NULL DEFAULT '[]'
);
