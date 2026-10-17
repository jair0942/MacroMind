
import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrations';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!databasePromise) {
    databasePromise = (async () => {
      console.log('[MacroMind] Abriendo SQLite...');
      const db = await SQLite.openDatabaseAsync('macromind.db');

      console.log('[MacroMind] Activando claves foráneas...');
      await db.execAsync('PRAGMA foreign_keys = ON;');

      console.log('[MacroMind] Ejecutando migraciones...');
      await runMigrations(db);
      console.log('[MacroMind] Migraciones terminadas.');

      return db;
    })().catch((error) => {
      databasePromise = null;
      console.error('[MacroMind] Error inicializando SQLite:', error);
      throw error;
    });
  }

  return databasePromise;
};

export const resetDatabaseConnection = (): void => {
  databasePromise = null;
};