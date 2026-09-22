/**
 * Re-export do auth-pb.ts.
 * Garante que imports `from '@/lib/auth'` continuem funcionando.
 * Toda lógica de auth está em auth-pb.ts (que usa PocketBase).
 */

export {
  requireAuth,
  requireAuthApi,
  getOrgId,
  isSuperAdmin,
  type UserProfile,
} from './auth-pb';
