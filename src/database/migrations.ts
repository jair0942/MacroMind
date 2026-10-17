import type * as SQLite from 'expo-sqlite';

type Migration = { version: number; statements: string[] };

const migrations: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);`,
      `CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT, birth_date TEXT,
        current_weight_kg REAL NOT NULL CHECK (current_weight_kg > 0), height_cm REAL NOT NULL CHECK (height_cm > 0),
        sex TEXT NOT NULL DEFAULT 'unspecified' CHECK (sex IN ('female', 'male', 'unspecified')),
        activity_level TEXT NOT NULL CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'high')),
        goal TEXT NOT NULL CHECK (goal IN ('fat_loss', 'maintenance', 'muscle_gain', 'recomposition')),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS daily_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT, goal_date TEXT NOT NULL UNIQUE,
        calories REAL NOT NULL CHECK (calories >= 0), protein REAL NOT NULL CHECK (protein >= 0),
        carbohydrates REAL NOT NULL CHECK (carbohydrates >= 0), fat REAL NOT NULL CHECK (fat >= 0)
      );`,
      `CREATE TABLE IF NOT EXISTS foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE,
        calories_per_100g REAL NOT NULL DEFAULT 0, protein_per_100g REAL NOT NULL DEFAULT 0,
        carbohydrates_per_100g REAL NOT NULL DEFAULT 0, fat_per_100g REAL NOT NULL DEFAULT 0,
        fiber_per_100g REAL, source TEXT NOT NULL DEFAULT 'manual', verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1))
      );`,
      `CREATE TABLE IF NOT EXISTS meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT, recorded_at TEXT NOT NULL, meal_type TEXT NOT NULL,
        image_uri TEXT, notes TEXT, analysis_status TEXT NOT NULL, created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS meal_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
        food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL, name TEXT NOT NULL,
        grams REAL NOT NULL CHECK (grams >= 0), calories REAL NOT NULL DEFAULT 0,
        protein REAL NOT NULL DEFAULT 0, carbohydrates REAL NOT NULL DEFAULT 0, fat REAL NOT NULL DEFAULT 0,
        estimation_method TEXT NOT NULL, notes TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS weight_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT, entry_date TEXT NOT NULL UNIQUE,
        weight_kg REAL NOT NULL CHECK (weight_kg > 0), notes TEXT
      );`,
      `CREATE INDEX IF NOT EXISTS idx_meals_recorded_at ON meals(recorded_at);`,
      `CREATE INDEX IF NOT EXISTS idx_meal_items_meal_id ON meal_items(meal_id);`,
      `CREATE INDEX IF NOT EXISTS idx_weight_entries_date ON weight_entries(entry_date);`,
    ],
  },
  {
    version: 2,
    statements: [
      `CREATE INDEX IF NOT EXISTS idx_daily_goals_goal_date ON daily_goals(goal_date);`,
      `CREATE INDEX IF NOT EXISTS idx_foods_normalized_name ON foods(normalized_name);`,
    ],
  },
  {
    version: 3,
    statements: [
      `CREATE TABLE profiles_v3 (
        id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT, birth_date TEXT,
        current_weight_kg REAL NOT NULL CHECK (current_weight_kg > 0), height_cm REAL NOT NULL CHECK (height_cm > 0),
        sex TEXT NOT NULL DEFAULT 'unspecified',
        activity_level TEXT NOT NULL DEFAULT 'moderate',
        goal TEXT NOT NULL DEFAULT 'maintenance',
        training_type TEXT NOT NULL DEFAULT 'none', training_frequency REAL NOT NULL DEFAULT 0,
        session_duration_minutes REAL NOT NULL DEFAULT 0, target_rate_kg_week REAL NOT NULL DEFAULT 0,
        safety_context TEXT NOT NULL DEFAULT 'none', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );`,
      `INSERT INTO profiles_v3 (id, name, birth_date, current_weight_kg, height_cm, sex, activity_level, goal, created_at, updated_at)
       SELECT id, name, birth_date, current_weight_kg, height_cm, sex,
       CASE WHEN activity_level = 'high' THEN 'very_active' ELSE activity_level END,
       goal, created_at, updated_at FROM profiles;`,
      `DROP TABLE profiles;`,
      `ALTER TABLE profiles_v3 RENAME TO profiles;`,
      `ALTER TABLE weight_entries ADD COLUMN recorded_at TEXT;`,
      `UPDATE weight_entries SET recorded_at = entry_date || 'T12:00:00.000Z' WHERE recorded_at IS NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_weight_entries_recorded_at ON weight_entries(recorded_at);`,
    ],
  },
  {
    version: 4,
    statements: [
      `ALTER TABLE profiles ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0;`,
      `ALTER TABLE profiles ADD COLUMN onboarding_completed_at TEXT;`,
      `UPDATE profiles
       SET onboarding_completed = CASE
         WHEN birth_date IS NOT NULL AND current_weight_kg > 0 AND height_cm > 0 THEN 1
         ELSE 0
       END,
       onboarding_completed_at = CASE
         WHEN birth_date IS NOT NULL AND current_weight_kg > 0 AND height_cm > 0 THEN updated_at
         ELSE NULL
       END;`,
    ],
  },
  {
    version: 5,
    statements: [
      `ALTER TABLE foods ADD COLUMN source_id TEXT;`,
      `ALTER TABLE foods ADD COLUMN barcode TEXT;`,
      `ALTER TABLE foods ADD COLUMN preparation_state TEXT NOT NULL DEFAULT 'unknown';`,
      `ALTER TABLE foods ADD COLUMN data_quality TEXT NOT NULL DEFAULT 'complete';`,
      `CREATE INDEX IF NOT EXISTS idx_foods_barcode ON foods(barcode);`,
      `CREATE INDEX IF NOT EXISTS idx_foods_source_id ON foods(source, source_id);`,
    ],
  },
  {
    version: 6,
    statements: [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );`,
      `INSERT OR IGNORE INTO users (id, display_name, created_at, updated_at)
       SELECT 1,
         COALESCE((SELECT NULLIF(trim(name), '') FROM profiles WHERE id = 1), 'Usuario principal'),
         COALESCE((SELECT created_at FROM profiles WHERE id = 1), CURRENT_TIMESTAMP),
         COALESCE((SELECT updated_at FROM profiles WHERE id = 1), CURRENT_TIMESTAMP)
       WHERE EXISTS (SELECT 1 FROM profiles)
          OR EXISTS (SELECT 1 FROM meals)
          OR EXISTS (SELECT 1 FROM daily_goals)
          OR EXISTS (SELECT 1 FROM weight_entries);`,
      `CREATE TABLE profiles_v6 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        name TEXT, birth_date TEXT,
        current_weight_kg REAL NOT NULL CHECK (current_weight_kg > 0), height_cm REAL NOT NULL CHECK (height_cm > 0),
        sex TEXT NOT NULL DEFAULT 'unspecified', activity_level TEXT NOT NULL DEFAULT 'moderate',
        goal TEXT NOT NULL DEFAULT 'maintenance', training_type TEXT NOT NULL DEFAULT 'none',
        training_frequency REAL NOT NULL DEFAULT 0, session_duration_minutes REAL NOT NULL DEFAULT 0,
        target_rate_kg_week REAL NOT NULL DEFAULT 0, safety_context TEXT NOT NULL DEFAULT 'none',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        onboarding_completed INTEGER NOT NULL DEFAULT 0, onboarding_completed_at TEXT
      );`,
      `INSERT INTO profiles_v6 (id, user_id, name, birth_date, current_weight_kg, height_cm, sex, activity_level, goal,
        training_type, training_frequency, session_duration_minutes, target_rate_kg_week, safety_context,
        created_at, updated_at, onboarding_completed, onboarding_completed_at)
       SELECT id, 1, name, birth_date, current_weight_kg, height_cm, sex, activity_level, goal,
        training_type, training_frequency, session_duration_minutes, target_rate_kg_week, safety_context,
        created_at, updated_at, onboarding_completed, onboarding_completed_at
       FROM profiles;`,
      `DROP TABLE profiles;`,
      `ALTER TABLE profiles_v6 RENAME TO profiles;`,
      `CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);`,
      `CREATE TABLE daily_goals_v6 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        goal_date TEXT NOT NULL,
        calories REAL NOT NULL CHECK (calories >= 0), protein REAL NOT NULL CHECK (protein >= 0),
        carbohydrates REAL NOT NULL CHECK (carbohydrates >= 0), fat REAL NOT NULL CHECK (fat >= 0),
        UNIQUE(user_id, goal_date)
      );`,
      `INSERT INTO daily_goals_v6 (id, user_id, goal_date, calories, protein, carbohydrates, fat)
       SELECT id, 1, goal_date, calories, protein, carbohydrates, fat FROM daily_goals;`,
      `DROP TABLE daily_goals;`,
      `ALTER TABLE daily_goals_v6 RENAME TO daily_goals;`,
      `CREATE INDEX IF NOT EXISTS idx_daily_goals_user_date ON daily_goals(user_id, goal_date);`,
      `CREATE TABLE meals_v6 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recorded_at TEXT NOT NULL, meal_type TEXT NOT NULL, image_uri TEXT, notes TEXT,
        analysis_status TEXT NOT NULL, created_at TEXT NOT NULL
      );`,
      `INSERT INTO meals_v6 (id, user_id, recorded_at, meal_type, image_uri, notes, analysis_status, created_at)
       SELECT id, 1, recorded_at, meal_type, image_uri, notes, analysis_status, created_at FROM meals;`,
      `CREATE TABLE meal_items_v6 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_id INTEGER NOT NULL REFERENCES meals_v6(id) ON DELETE CASCADE,
        food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL, name TEXT NOT NULL,
        grams REAL NOT NULL CHECK (grams >= 0), calories REAL NOT NULL DEFAULT 0,
        protein REAL NOT NULL DEFAULT 0, carbohydrates REAL NOT NULL DEFAULT 0, fat REAL NOT NULL DEFAULT 0,
        estimation_method TEXT NOT NULL, notes TEXT
      );`,
      `INSERT INTO meal_items_v6 (id, meal_id, food_id, name, grams, calories, protein, carbohydrates, fat, estimation_method, notes)
       SELECT id, meal_id, food_id, name, grams, calories, protein, carbohydrates, fat, estimation_method, notes FROM meal_items;`,
      `DROP TABLE meal_items;`,
      `DROP TABLE meals;`,
      `ALTER TABLE meals_v6 RENAME TO meals;`,
      `ALTER TABLE meal_items_v6 RENAME TO meal_items;`,
      `CREATE INDEX IF NOT EXISTS idx_meals_user_recorded_at ON meals(user_id, recorded_at);`,
      `CREATE INDEX IF NOT EXISTS idx_meal_items_meal_id ON meal_items(meal_id);`,
      `CREATE TABLE weight_entries_v6 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        entry_date TEXT NOT NULL, recorded_at TEXT NOT NULL,
        weight_kg REAL NOT NULL CHECK (weight_kg > 0), notes TEXT,
        UNIQUE(user_id, entry_date)
      );`,
      `INSERT INTO weight_entries_v6 (id, user_id, entry_date, recorded_at, weight_kg, notes)
       SELECT id, 1, entry_date, COALESCE(recorded_at, entry_date || 'T12:00:00.000Z'), weight_kg, notes
       FROM weight_entries;`,
      `DROP TABLE weight_entries;`,
      `ALTER TABLE weight_entries_v6 RENAME TO weight_entries;`,
      `CREATE INDEX IF NOT EXISTS idx_weight_entries_user_date ON weight_entries(user_id, entry_date);`,
    ],
  },
  {
    version: 7,
    statements: [
      `ALTER TABLE users ADD COLUMN username TEXT;`,
      `ALTER TABLE users ADD COLUMN password_salt TEXT;`,
      `ALTER TABLE users ADD COLUMN password_hash TEXT;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;`,
    ],
  },
];

export const runMigrations = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  await db.execAsync(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);`);
  const current = await db.getFirstAsync<{ version: number }>('SELECT version FROM schema_version LIMIT 1');
  const currentVersion = current?.version ?? 0;
  for (const migration of migrations.filter((item) => item.version > currentVersion)) {
    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) await db.execAsync(statement);
      await db.runAsync('DELETE FROM schema_version');
      await db.runAsync('INSERT INTO schema_version (version) VALUES (?)', migration.version);
    });
  }
};
