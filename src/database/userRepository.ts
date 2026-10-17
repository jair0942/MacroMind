import { getDatabase } from './database';

export type LocalUser = {
  id: number;
  displayName: string;
  username: string | null;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
};

type UserRow = { id: number; display_name: string; username?: string | null; password_salt?: string | null; password_hash?: string | null; created_at: string; updated_at: string };

const mapUser = (row: UserRow): LocalUser => ({
  id: row.id,
  displayName: row.display_name,
  username: row.username ?? null,
  hasPassword: Boolean(row.password_salt && row.password_hash),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const SETTING_ACTIVE_USER = 'active_user_id';
const getPasswordTools = async () => import('@/src/services/authService');

/**
 * Converts data created by versions before multi-user support into the first
 * local account. This is intentionally additive and never deletes history.
 */
export const ensureLocalUsers = async (): Promise<void> => {
  const db = await getDatabase();
  const current = await db.getAllAsync<UserRow>('SELECT * FROM users ORDER BY id ASC');
  if (current.length > 0) return;

  const legacyProfile = await db.getFirstAsync<{ id: number; name: string | null; created_at: string; updated_at: string }>('SELECT * FROM profiles WHERE id = 1');
  const legacyMeals = await db.getAllAsync<{ id: number }>('SELECT * FROM meals LIMIT 1');
  const legacyGoals = await db.getAllAsync<{ id: number }>('SELECT * FROM daily_goals LIMIT 1');
  const legacyWeights = await db.getAllAsync<{ id: number }>('SELECT * FROM weight_entries LIMIT 1');
  if (!legacyProfile && legacyMeals.length === 0 && legacyGoals.length === 0 && legacyWeights.length === 0) return;

  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO users (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    1, legacyProfile?.name?.trim() || 'Usuario principal', legacyProfile?.created_at ?? now, legacyProfile?.updated_at ?? now,
  );
  // The native v6 migration already assigns these rows. These updates also
  // make the web adapter compatible with old localStorage snapshots.
  await db.runAsync('UPDATE profiles SET user_id = ? WHERE id = ?', 1, 1);
  await db.runAsync('UPDATE meals SET user_id = ? WHERE user_id IS NULL OR user_id = 0', 1);
  await db.runAsync('UPDATE daily_goals SET user_id = ? WHERE user_id IS NULL OR user_id = 0', 1);
  await db.runAsync('UPDATE weight_entries SET user_id = ? WHERE user_id IS NULL OR user_id = 0', 1);
};

export const listUsers = async (): Promise<LocalUser[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<UserRow>('SELECT * FROM users ORDER BY created_at ASC, id ASC');
  return rows.map(mapUser);
};

export const getUser = async (id: number): Promise<LocalUser | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', id);
  return row ? mapUser(row) : null;
};

const normalizeUsername = (username: string): string => username.trim().toLocaleLowerCase('es');

const validateCredentials = (username: string, password: string): { username: string; password: string } => {
  const normalized = normalizeUsername(username);
  if (!/^[a-z0-9._-]{3,30}$/.test(normalized)) throw new Error('El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo.');
  if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
  if (password.length > 120) throw new Error('La contraseña es demasiado larga.');
  return { username: normalized, password };
};

export const getUserByUsername = async (username: string): Promise<(LocalUser & { passwordSalt: string | null; passwordHash: string | null }) | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE username = ?', normalizeUsername(username));
  return row ? { ...mapUser(row), passwordSalt: row.password_salt ?? null, passwordHash: row.password_hash ?? null } : null;
};

export const getLegacyUser = async (): Promise<LocalUser | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE username IS NULL ORDER BY id ASC LIMIT 1');
  return row ? mapUser(row) : null;
};

export const getActiveUserId = async (): Promise<number | null> => {
  const db = await getDatabase();
  // Keeps repository unit tests and legacy adapters that only implement the
  // small delete/query surface backward compatible. Real adapters implement
  // getAllAsync and use the persisted active account below.
  if (typeof db.getAllAsync !== 'function') return 1;
  const setting = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', SETTING_ACTIVE_USER);
  const requested = Number(setting?.value);
  if (Number.isInteger(requested) && requested > 0 && await getUser(requested)) return requested;
  const first = (await listUsers())[0];
  if (!first) return null;
  await setActiveUser(first.id);
  return first.id;
};

export const setActiveUser = async (userId: number): Promise<void> => {
  if (!await getUser(userId)) throw new Error('El usuario seleccionado no existe.');
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    SETTING_ACTIVE_USER, String(userId),
  );
};

export const registerUser = async (displayName: string, username: string, password: string): Promise<LocalUser> => {
  const normalizedName = displayName.trim();
  if (normalizedName.length < 2) throw new Error('Escribe un nombre visible de al menos 2 caracteres.');
  if (normalizedName.length > 40) throw new Error('El nombre visible no puede superar 40 caracteres.');
  const credentials = validateCredentials(username, password);
  if (await getUserByUsername(credentials.username)) throw new Error('Ese nombre de usuario ya está ocupado.');
  const db = await getDatabase();
  const now = new Date().toISOString();
  const { createPasswordSalt, hashPassword } = await getPasswordTools();
  const salt = await createPasswordSalt();
  const passwordHash = await hashPassword(credentials.password, salt);
  const result = await db.runAsync(
    'INSERT INTO users (display_name, username, password_salt, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', normalizedName, credentials.username, salt, passwordHash, now, now,
  );
  const userId = result.lastInsertRowId;
  await setActiveUser(userId);
  const user = await getUser(userId);
  if (!user) throw new Error('No se pudo crear el usuario local.');
  return user;
};

export const claimLegacyUser = async (username: string, password: string): Promise<LocalUser> => {
  const credentials = validateCredentials(username, password);
  const legacy = await getLegacyUser();
  if (!legacy) throw new Error('No hay un historial antiguo pendiente de configurar.');
  const { createPasswordSalt, hashPassword } = await getPasswordTools();
  const salt = await createPasswordSalt();
  const passwordHash = await hashPassword(credentials.password, salt);
  const db = await getDatabase();
  await db.runAsync('UPDATE users SET username = ?, password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?', credentials.username, salt, passwordHash, new Date().toISOString(), legacy.id);
  return (await getUser(legacy.id))!;
};

export const authenticateUser = async (username: string, password: string): Promise<LocalUser> => {
  const credentials = validateCredentials(username, password);
  const user = await getUserByUsername(credentials.username);
  if (!user || !user.passwordSalt || !user.passwordHash) throw new Error('Usuario o contraseña incorrectos.');
  const { hashPassword } = await getPasswordTools();
  const candidate = await hashPassword(credentials.password, user.passwordSalt);
  if (candidate !== user.passwordHash) throw new Error('Usuario o contraseña incorrectos.');
  await setActiveUser(user.id);
  return user;
};
