import { useAuth } from '@/store/auth';
export const useRole = () => {
  const { user, isOwner } = useAuth();
  return { role: user?.role, isOwner, isAdmin: isOwner, canManageStaff: false, canAccessCriticalSettings: isOwner, canReverseTransactions: isOwner };
};
