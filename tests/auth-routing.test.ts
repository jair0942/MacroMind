import { describe, expect, it } from 'vitest';

import { getAuthRedirect } from '../src/utils/authRouting';

const state = (overrides: Partial<Parameters<typeof getAuthRedirect>[0]> = {}) => ({
  ready: true,
  error: null,
  authenticated: false,
  profileCompleted: false,
  pathname: '/',
  ...overrides,
});

describe('redirecciones de autenticación', () => {
  it('mantiene la carga mientras la aplicación se prepara', () => {
    expect(getAuthRedirect(state({ ready: false }))).toBeNull();
    expect(getAuthRedirect(state({ error: 'fallo' }))).toBeNull();
  });

  it('lleva a un usuario nuevo al login', () => {
    expect(getAuthRedirect(state())).toBe('/auth');
    expect(getAuthRedirect(state({ pathname: '/onboarding' }))).toBe('/auth');
  });

  it('no redirige un login sin sesión', () => {
    expect(getAuthRedirect(state({ pathname: '/auth' }))).toBeNull();
  });

  it('lleva una sesión nueva al onboarding', () => {
    expect(getAuthRedirect(state({ authenticated: true }))).toBe('/onboarding');
    expect(getAuthRedirect(state({ authenticated: true, pathname: '/auth' }))).toBe('/onboarding');
  });

  it('lleva una sesión completa al dashboard', () => {
    expect(getAuthRedirect(state({ authenticated: true, profileCompleted: true, pathname: '/auth' }))).toBe('/');
    expect(getAuthRedirect(state({ authenticated: true, profileCompleted: true, pathname: '/onboarding' }))).toBe('/');
  });

  it('no crea ciclos cuando la ruta ya es la correcta', () => {
    expect(getAuthRedirect(state({ authenticated: true, pathname: '/onboarding' }))).toBeNull();
    expect(getAuthRedirect(state({ authenticated: true, profileCompleted: true, pathname: '/' }))).toBeNull();
  });
});
