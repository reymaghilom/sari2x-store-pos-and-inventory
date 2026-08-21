import { useAuth } from '@/store/auth';
export const useRole = () => {
  const { user, isAdmin } = useAuth();
  return { role: user?.role, isAdmin, canManageStaff: isAdmin, canAccessCriticalSettings: isAdmin };
};
