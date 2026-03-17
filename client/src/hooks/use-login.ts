import { useAuthModal } from "./use-auth-modal";

export function useLogin() {
  const { login } = useAuthModal();
  return { login };
}
