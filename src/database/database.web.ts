/*
 * Web fallback for the local database.
 *
 * expo-sqlite's web worker is still experimental in the current Expo SDK and
 * can prevent Metro from building the browser bundle. Mobile builds resolve
 * database.ts and use SQLite; the browser preview uses this small localStorage
 * adapter with the same methods used by the repositories.
 */

type Row = Record<string, unknown>;

type WebState = {
  users: Row[];
  app_settings: Row[];
  profiles: Row[];
  daily_goals: Row[];
  foods: Row[];
  meals: Row[];
  meal_items: Row[];
  weight_entries: Row[];
};

type RunResult = { lastInsertRowId: number; changes: number };

const STORAGE_KEY = 'macromind.web.database.v1';

const emptyState = (): WebState => ({
  users: [], app_settings: [],
  profiles: [], daily_goals: [], foods: [], meals: [], meal_items: [], weight_entries: [],
});

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const readState = (): WebState => {
  if (typeof globalThis.localStorage === 'undefined') return emptyState();
  try {
    const saved = globalThis.localStorage.getItem(STORAGE_KEY);
    return saved ? { ...emptyState(), ...JSON.parse(saved) as WebState } : emptyState();
  } catch {
    return emptyState();
  }
};

const writeState = (state: WebState): void => {
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
};

const nextId = (rows: Row[]): number => rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;

const localDate = (value: string): string => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

class WebDatabase {
  private state = readState();

  private persist(): void {
    writeState(this.state);
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toUpperCase();
    if (normalized.includes('FROM APP_SETTINGS')) {
      return clone(this.state.app_settings.find((row) => row.key === params[0]) ?? null) as T | null;
    }
    if (normalized.includes('FROM USERS')) {
      const row = normalized.includes('USERNAME = ?')
        ? this.state.users.find((candidate) => String(candidate.username ?? '') === String(params[0]))
        : normalized.includes('USERNAME IS NULL')
          ? this.state.users.find((candidate) => candidate.username == null)
          : this.state.users.find((candidate) => Number(candidate.id) === Number(params[0]));
      return clone(row ?? null) as T | null;
    }
    if (normalized.includes('FROM PROFILES')) {
      const userId = normalized.includes('USER_ID =') ? Number(params[0]) : Number(params[0] ?? 1);
      return clone(this.state.profiles.find((row) => Number(row.user_id ?? row.id) === userId) ?? null) as T | null;
    }
    if (normalized.includes('FROM DAILY_GOALS')) {
      const hasUser = normalized.includes('USER_ID =');
      const userId = hasUser ? Number(params[0]) : null;
      const date = hasUser ? params[1] : params[0];
      const candidates = this.state.daily_goals.filter((row) => userId === null || Number(row.user_id ?? 1) === userId);
      const exact = candidates.find((row) => row.goal_date === date);
      const fallbackDate = hasUser ? params[3] : (params[1] ?? params[0]);
      const fallback = candidates.filter((row) => String(row.goal_date) < String(fallbackDate)).sort((a, b) => String(b.goal_date).localeCompare(String(a.goal_date)))[0];
      return clone(exact ?? fallback ?? null) as T | null;
    }
    if (normalized.includes('FROM FOODS')) {
      return clone(this.state.foods.find((row) => row.normalized_name === params[0]) ?? null) as T | null;
    }
    if (normalized.includes('FROM MEALS') && normalized.includes('WHERE ID =')) {
      return clone(this.state.meals.find((row) => Number(row.id) === Number(params[0])) ?? null) as T | null;
    }
    if (normalized.includes('SUM(MI.CALORIES)')) {
      const hasUser = normalized.includes('M.USER_ID =');
      const userId = hasUser ? Number(params[0]) : null;
      const date = String(hasUser ? params[1] : params[0]);
      const mealIds = new Set(this.state.meals.filter((meal) => (userId === null || Number(meal.user_id ?? 1) === userId) && localDate(String(meal.recorded_at)) === date).map((meal) => meal.id));
      const items = this.state.meal_items.filter((item) => mealIds.has(item.meal_id));
      return {
        calories: items.reduce((sum, item) => sum + Number(item.calories), 0),
        protein: items.reduce((sum, item) => sum + Number(item.protein), 0),
        carbohydrates: items.reduce((sum, item) => sum + Number(item.carbohydrates), 0),
        fat: items.reduce((sum, item) => sum + Number(item.fat), 0),
      } as T;
    }
    return null;
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toUpperCase();
    let rows: Row[] = [];
    if (normalized.includes('FROM USERS')) {
      rows = [...this.state.users];
      rows.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || Number(a.id) - Number(b.id));
    } else if (normalized.includes('FROM APP_SETTINGS')) {
      rows = [...this.state.app_settings];
    } else if (normalized.includes('FROM FOODS')) {
      const query = String(params[0] ?? '').replace(/%/g, '').toLocaleLowerCase('es');
      rows = this.state.foods.filter((row) => String(row.name).toLocaleLowerCase('es').includes(query));
      rows.sort((a, b) => Number(b.verified) - Number(a.verified) || String(a.name).localeCompare(String(b.name)));
      rows = rows.slice(0, 20);
    } else if (normalized.includes('FROM MEAL_ITEMS')) {
      rows = this.state.meal_items.filter((row) => Number(row.meal_id) === Number(params[0])).map((row) => {
        if (!normalized.includes('JOIN FOODS')) return row;
        const food = this.state.foods.find((candidate) => Number(candidate.id) === Number(row.food_id));
        return { ...row, nutrition_source: food?.source ?? null, source_id: food?.source_id ?? null, barcode: food?.barcode ?? null, preparation_state: food?.preparation_state ?? 'unknown', data_quality: food?.data_quality ?? 'unknown' };
      });
      rows.sort((a, b) => Number(a.id) - Number(b.id));
    } else if (normalized.includes('FROM MEALS')) {
      rows = [...this.state.meals];
      if (normalized.includes('USER_ID = ?')) {
        const userParam = params[0];
        rows = rows.filter((row) => Number(row.user_id ?? 1) === Number(userParam));
      }
      if (normalized.includes("DATE(RECORDED_AT, 'LOCALTIME')")) {
        const offset = normalized.includes('USER_ID = ?') ? 1 : 0;
        if (normalized.includes('>= ?') && normalized.includes('<= ?')) rows = rows.filter((row) => localDate(String(row.recorded_at)) >= String(params[offset]) && localDate(String(row.recorded_at)) <= String(params[offset + 1]));
        else rows = rows.filter((row) => localDate(String(row.recorded_at)) === String(params[offset]));
      }
      rows.sort((a, b) => String(b.recorded_at).localeCompare(String(a.recorded_at)));
      if (normalized.includes('LIMIT')) rows = rows.slice(0, Number(params[params.length - 1] ?? 5));
    } else if (normalized.includes('FROM WEIGHT_ENTRIES')) {
      rows = [...this.state.weight_entries];
      if (normalized.includes('USER_ID = ?')) rows = rows.filter((row) => Number(row.user_id ?? 1) === Number(params[0]));
      const offset = normalized.includes('USER_ID = ?') ? 1 : 0;
      if (normalized.includes('ENTRY_DATE >= ?')) rows = rows.filter((row) => String(row.entry_date) >= String(params[offset]) && String(row.entry_date) <= String(params[offset + 1]));
      rows.sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date)));
    } else if (normalized.includes('FROM PROFILES')) rows = [...this.state.profiles];
    else if (normalized.includes('FROM DAILY_GOALS')) rows = [...this.state.daily_goals];
    else if (normalized.includes('FROM FOODS')) rows = [...this.state.foods];
    return clone(rows) as T[];
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<RunResult> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toUpperCase();
    let lastInsertRowId = 0;
    let changes = 0;

    if (normalized.startsWith('INSERT INTO USERS') || normalized.startsWith('INSERT OR IGNORE INTO USERS')) {
      const explicitId = params.length === 4;
      const withCredentials = params.length === 6;
      const row = explicitId
        ? { id: params[0], display_name: params[1], username: null, password_salt: null, password_hash: null, created_at: params[2], updated_at: params[3] }
        : withCredentials
          ? { id: nextId(this.state.users), display_name: params[0], username: params[1], password_salt: params[2], password_hash: params[3], created_at: params[4], updated_at: params[5] }
          : { id: nextId(this.state.users), display_name: params[0], username: null, password_salt: null, password_hash: null, created_at: params[1], updated_at: params[2] };
      const existing = this.state.users.findIndex((item) => Number(item.id) === Number(row.id));
      if (existing >= 0) this.state.users[existing] = row; else this.state.users.push(row);
      lastInsertRowId = Number(row.id); changes = 1;
    } else if (normalized.startsWith('INSERT INTO APP_SETTINGS')) {
      const existing = this.state.app_settings.findIndex((item) => item.key === params[0]);
      const row = { key: params[0], value: params[1] };
      if (existing >= 0) this.state.app_settings[existing] = row; else this.state.app_settings.push(row);
      changes = 1;
    } else if (normalized.startsWith('INSERT INTO PROFILES')) {
      const legacy = params.length === 14;
      const row = legacy
        ? { id: 1, name: params[0], birth_date: params[1], current_weight_kg: params[2], height_cm: params[3], sex: params[4], activity_level: params[5], goal: params[6], training_type: params[7], training_frequency: params[8], session_duration_minutes: params[9], target_rate_kg_week: params[10], safety_context: params[11], created_at: params[12], updated_at: params[13], onboarding_completed: 0, onboarding_completed_at: null }
        : { id: nextId(this.state.profiles), user_id: params[0], name: params[1], birth_date: params[2], current_weight_kg: params[3], height_cm: params[4], sex: params[5], activity_level: params[6], goal: params[7], training_type: params[8], training_frequency: params[9], session_duration_minutes: params[10], target_rate_kg_week: params[11], safety_context: params[12], created_at: params[13], updated_at: params[14], onboarding_completed: 0, onboarding_completed_at: null };
      const existing = this.state.profiles.findIndex((item) => Number(item.user_id ?? item.id) === Number(legacy ? 1 : row.user_id));
      if (existing >= 0) this.state.profiles[existing] = { ...this.state.profiles[existing], ...row, onboarding_completed: this.state.profiles[existing].onboarding_completed ?? 0, onboarding_completed_at: this.state.profiles[existing].onboarding_completed_at ?? null, created_at: this.state.profiles[existing].created_at };
      else this.state.profiles.push(row);
      changes = 1;
    } else if (normalized.startsWith('UPDATE PROFILES SET ONBOARDING_COMPLETED')) {
      const scoped = normalized.includes('USER_ID = ?');
      const row = this.state.profiles.find((item) => Number(item.user_id ?? item.id) === Number(scoped ? params[2] : 1));
      if (row) {
        const completed = normalized.includes('ONBOARDING_COMPLETED = 1,') || normalized.includes('ONBOARDING_COMPLETED = 1 ');
        Object.assign(row, { onboarding_completed: completed ? 1 : 0, onboarding_completed_at: completed ? params[0] : null, updated_at: completed ? params[1] : params[0] });
        changes = 1;
      }
    } else if (normalized.startsWith('UPDATE PROFILES SET USER_ID')) {
      const row = this.state.profiles.find((item) => Number(item.id) === Number(params[1]));
      if (row) { row.user_id = params[0]; changes = 1; }
    } else if (normalized.startsWith('UPDATE PROFILES SET')) {
      const row = this.state.profiles.find((item) => Number(item.user_id ?? item.id) === Number(params.at(-1)));
      if (row) { Object.assign(row, { name: params[0], birth_date: params[1], current_weight_kg: params[2], height_cm: params[3], sex: params[4], activity_level: params[5], goal: params[6], training_type: params[7], training_frequency: params[8], session_duration_minutes: params[9], target_rate_kg_week: params[10], safety_context: params[11], updated_at: params[12] }); changes = 1; }
    } else if (normalized.startsWith('UPDATE USERS SET USERNAME')) {
      const row = this.state.users.find((item) => Number(item.id) === Number(params[4]));
      if (row) { Object.assign(row, { username: params[0], password_salt: params[1], password_hash: params[2], updated_at: params[3] }); changes = 1; }
    } else if (normalized.startsWith('UPDATE USERS SET')) {
      const row = this.state.users.find((item) => Number(item.id) === Number(params[params.length - 1]));
      if (row) { if (params.length > 1 && params[0] !== null) row.display_name = params[0]; row.updated_at = params[1]; changes = 1; }
    } else if (normalized.startsWith('UPDATE MEALS SET USER_ID')) {
      for (const row of this.state.meals) if (row.user_id == null || Number(row.user_id) === 0) row.user_id = params[0];
      changes = 1;
    } else if (normalized.startsWith('UPDATE DAILY_GOALS SET USER_ID')) {
      for (const row of this.state.daily_goals) if (row.user_id == null || Number(row.user_id) === 0) row.user_id = params[0];
      changes = 1;
    } else if (normalized.startsWith('UPDATE WEIGHT_ENTRIES SET USER_ID')) {
      for (const row of this.state.weight_entries) if (row.user_id == null || Number(row.user_id) === 0) row.user_id = params[0];
      changes = 1;
    } else if (normalized.startsWith('INSERT INTO DAILY_GOALS')) {
      const legacy = params.length === 5;
      const userId = legacy ? 1 : params[0];
      const date = legacy ? params[0] : params[1];
      const existing = this.state.daily_goals.findIndex((item) => Number(item.user_id ?? 1) === Number(userId) && item.goal_date === date);
      const row = { id: existing >= 0 ? this.state.daily_goals[existing].id : nextId(this.state.daily_goals), user_id: userId, goal_date: date, calories: legacy ? params[1] : params[2], protein: legacy ? params[2] : params[3], carbohydrates: legacy ? params[3] : params[4], fat: legacy ? params[4] : params[5] };
      if (existing >= 0) this.state.daily_goals[existing] = row; else this.state.daily_goals.push(row);
      lastInsertRowId = Number(row.id); changes = 1;
    } else if (normalized.startsWith('INSERT INTO FOODS')) {
      const existing = this.state.foods.findIndex((item) => item.normalized_name === params[1]);
      const row = { id: existing >= 0 ? this.state.foods[existing].id : nextId(this.state.foods), name: params[0], normalized_name: params[1], calories_per_100g: params[2], protein_per_100g: params[3], carbohydrates_per_100g: params[4], fat_per_100g: params[5], fiber_per_100g: params[6], source: params[7], verified: params[8], source_id: params[9] ?? null, barcode: params[10] ?? null, preparation_state: params[11] ?? 'unknown', data_quality: params[12] ?? 'complete' };
      if (existing >= 0) this.state.foods[existing] = row; else this.state.foods.push(row);
      lastInsertRowId = Number(row.id); changes = 1;
    } else if (normalized.startsWith('INSERT INTO MEALS')) {
      const legacy = params.length === 6;
      const row = legacy ? { id: nextId(this.state.meals), recorded_at: params[0], meal_type: params[1], image_uri: params[2], notes: params[3], analysis_status: params[4], created_at: params[5] } : { id: nextId(this.state.meals), user_id: params[0], recorded_at: params[1], meal_type: params[2], image_uri: params[3], notes: params[4], analysis_status: params[5], created_at: params[6] };
      this.state.meals.push(row); lastInsertRowId = Number(row.id); changes = 1;
    } else if (normalized.startsWith('INSERT INTO MEAL_ITEMS')) {
      const row = { id: nextId(this.state.meal_items), meal_id: params[0], food_id: params[1], name: params[2], grams: params[3], calories: params[4], protein: params[5], carbohydrates: params[6], fat: params[7], estimation_method: params[8], notes: params[9] };
      this.state.meal_items.push(row); lastInsertRowId = Number(row.id); changes = 1;
    } else if (normalized.startsWith('UPDATE MEALS SET')) {
      const id = Number(params[5]);
      const row = this.state.meals.find((item) => Number(item.id) === id);
      if (row) Object.assign(row, { recorded_at: params[0], meal_type: params[1], image_uri: params[2], notes: params[3], analysis_status: params[4] });
      changes = row ? 1 : 0;
    } else if (normalized.startsWith('INSERT INTO WEIGHT_ENTRIES')) {
      const legacy = params.length === 4;
      const userId = legacy ? 1 : params[0];
      const date = legacy ? params[0] : params[1];
      const existing = this.state.weight_entries.findIndex((item) => Number(item.user_id ?? 1) === Number(userId) && item.entry_date === date);
      const row = { id: existing >= 0 ? this.state.weight_entries[existing].id : nextId(this.state.weight_entries), user_id: userId, entry_date: date, recorded_at: legacy ? params[1] : params[2], weight_kg: legacy ? params[2] : params[3], notes: legacy ? params[3] : params[4] };
      if (existing >= 0) this.state.weight_entries[existing] = row; else this.state.weight_entries.push(row);
      changes = 1;
    } else if (normalized.startsWith('DELETE FROM MEAL_ITEMS')) {
      const before = this.state.meal_items.length;
      this.state.meal_items = this.state.meal_items.filter((item) => Number(item.meal_id) !== Number(params[0]));
      changes = before - this.state.meal_items.length;
    } else if (normalized.startsWith('UPDATE WEIGHT_ENTRIES SET')) {
      const id = Number(params[4]);
      const row = this.state.weight_entries.find((item) => Number(item.id) === id);
      if (row) Object.assign(row, { entry_date: params[0], recorded_at: params[1], weight_kg: params[2], notes: params[3] });
      changes = row ? 1 : 0;
    } else if (normalized.startsWith('DELETE FROM WEIGHT_ENTRIES')) {
      const before = this.state.weight_entries.length;
      this.state.weight_entries = this.state.weight_entries.filter((item) => Number(item.id) !== Number(params[0]));
      changes = before - this.state.weight_entries.length;
    } else if (normalized.startsWith('DELETE FROM MEALS')) {
      const before = this.state.meals.length;
      const id = Number(params[0]);
      this.state.meals = this.state.meals.filter((item) => Number(item.id) !== id);
      this.state.meal_items = this.state.meal_items.filter((item) => Number(item.meal_id) !== id);
      changes = before - this.state.meals.length;
    } else if (normalized.startsWith('INSERT OR REPLACE INTO')) {
      changes = this.importRow(normalized, params);
    }
    this.persist();
    return { lastInsertRowId, changes };
  }

  private importRow(sql: string, params: unknown[]): number {
    if (sql.includes('INTO USERS')) this.state.users = [...this.state.users.filter((row) => row.id !== params[0]), params.length === 7 ? { id: params[0], display_name: params[1], username: params[2], password_salt: params[3], password_hash: params[4], created_at: params[5], updated_at: params[6] } : { id: params[0], display_name: params[1], username: null, password_salt: null, password_hash: null, created_at: params[2], updated_at: params[3] }];
    else if (sql.includes('INTO APP_SETTINGS')) this.state.app_settings = [...this.state.app_settings.filter((row) => row.key !== params[0]), { key: params[0], value: params[1] }];
    else if (sql.includes('INTO PROFILES')) this.state.profiles = [...this.state.profiles.filter((row) => row.id !== params[0]), { id: params[0], user_id: params[1], name: params[2], birth_date: params[3], current_weight_kg: params[4], height_cm: params[5], sex: params[6], activity_level: params[7], goal: params[8], training_type: params[9], training_frequency: params[10], session_duration_minutes: params[11], target_rate_kg_week: params[12], safety_context: params[13], created_at: params[14], updated_at: params[15], onboarding_completed: params[16] ?? 0, onboarding_completed_at: params[17] ?? null }];
    else if (sql.includes('INTO DAILY_GOALS')) this.state.daily_goals = [...this.state.daily_goals.filter((row) => row.id !== params[0]), { id: params[0], user_id: params[1], goal_date: params[2], calories: params[3], protein: params[4], carbohydrates: params[5], fat: params[6] }];
    else if (sql.includes('INTO FOODS')) this.state.foods = [...this.state.foods.filter((row) => row.id !== params[0]), { id: params[0], name: params[1], normalized_name: params[2], calories_per_100g: params[3], protein_per_100g: params[4], carbohydrates_per_100g: params[5], fat_per_100g: params[6], fiber_per_100g: params[7], source: params[8], verified: params[9], source_id: params[10] ?? null, barcode: params[11] ?? null, preparation_state: params[12] ?? 'unknown', data_quality: params[13] ?? 'complete' }];
    else if (sql.includes('INTO MEALS')) this.state.meals = [...this.state.meals.filter((row) => row.id !== params[0]), { id: params[0], user_id: params[1], recorded_at: params[2], meal_type: params[3], image_uri: params[4], notes: params[5], analysis_status: params[6], created_at: params[7] }];
    else if (sql.includes('INTO MEAL_ITEMS')) this.state.meal_items = [...this.state.meal_items.filter((row) => row.id !== params[0]), { id: params[0], meal_id: params[1], food_id: params[2], name: params[3], grams: params[4], calories: params[5], protein: params[6], carbohydrates: params[7], fat: params[8], estimation_method: params[9], notes: params[10] }];
    else if (sql.includes('INTO WEIGHT_ENTRIES')) this.state.weight_entries = [...this.state.weight_entries.filter((row) => row.id !== params[0]), { id: params[0], user_id: params[1], entry_date: params[2], recorded_at: params[3], weight_kg: params[4], notes: params[5] }];
    return 1;
  }

  async execAsync(sql: string): Promise<void> {
    for (const statement of sql.split(';').map((value) => value.trim()).filter(Boolean)) {
      const normalized = statement.toUpperCase();
      if (normalized.startsWith('DELETE FROM ')) {
        const table = normalized.replace('DELETE FROM ', '').trim().toLowerCase() as keyof WebState;
        if (table in this.state) this.state[table] = [];
      }
    }
    this.persist();
  }

  async withTransactionAsync<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }
}

let database: WebDatabase | null = null;

export const getDatabase = async (): Promise<WebDatabase> => {
  database ??= new WebDatabase();
  return database;
};

export const resetDatabaseConnection = (): void => { database = null; };
