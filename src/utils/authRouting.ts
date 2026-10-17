export type AppRoute = '/' | '/auth' | '/onboarding';

type AuthRoutingInput = {
  ready: boolean;
  error: string | null;
  authenticated: boolean;
  profileCompleted: boolean;
  pathname: string;
};

export const getAuthRedirect = ({ ready, error, authenticated, profileCompleted, pathname }: AuthRoutingInput): AppRoute | null => {
  if (!ready || error) return null;
  if (!authenticated) return pathname === '/auth' ? null : '/auth';
  if (pathname === '/auth') return profileCompleted ? '/' : '/onboarding';
  if (!profileCompleted && pathname !== '/onboarding') return '/onboarding';
  if (profileCompleted && pathname === '/onboarding') return '/';
  return null;
};
