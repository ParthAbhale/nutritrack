import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthPayload, LoginInput, RegisterInput, ServerCapabilities, SessionInfo, UserProfile } from '@nutritrack/shared';
import { ApiError, api, request, setCsrfToken } from '@/lib/api';
import { keys } from './keys';

/** Restores the session on load. 401 (after a refresh attempt) means signed out → null. */
async function fetchMe(): Promise<UserProfile | null> {
  try {
    const { data } = await request<AuthPayload>('/auth/me');
    setCsrfToken(data.csrfToken);
    return data.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: fetchMe, staleTime: 5 * 60_000, retry: (n, err) => err instanceof ApiError && err.isNetwork && n < 2 });
}

export function useCurrentUser(): UserProfile {
  const { data } = useMe();
  if (!data) throw new Error('useCurrentUser must be used inside an authenticated route');
  return data;
}

export function useCapabilities() {
  return useQuery({ queryKey: keys.capabilities, queryFn: () => api.data<ServerCapabilities>('/capabilities'), staleTime: 10 * 60_000 });
}

type RegisterResult = AuthPayload & { emailSent: boolean; emailNotice?: string };

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api.post<RegisterResult>('/auth/register', { ...input, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    onSuccess: (data) => {
      setCsrfToken(data.csrfToken);
      qc.clear();
      qc.setQueryData(keys.me, data.user);
    },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<AuthPayload>('/auth/login', input),
    onSuccess: (data) => {
      setCsrfToken(data.csrfToken);
      qc.clear();
      qc.setQueryData(keys.me, data.user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    onSettled: () => {
      setCsrfToken(null);
      qc.clear();
      qc.setQueryData(keys.me, null);
    },
  });
}

export const authApi = {
  forgotPassword: (email: string) => api.post<{ message: string; emailDeliveryConfigured: boolean }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post<{ message: string }>('/auth/reset-password', { token, password }),
  verifyEmail: (token: string) => api.post<{ message: string }>('/auth/verify-email', { token }),
  resendVerification: () => api.post<{ emailSent: boolean; emailNotice?: string; alreadyVerified?: boolean }>('/auth/resend-verification'),
  changePassword: (currentPassword: string, newPassword: string) => api.post<{ message: string }>('/auth/change-password', { currentPassword, newPassword }),
};

export function useSessions() {
  return useQuery({ queryKey: keys.sessions, queryFn: () => api.data<SessionInfo[]>('/users/me/sessions') });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/users/me/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sessions }),
  });
}
