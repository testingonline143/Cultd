import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface AuthModalContextValue {
  login: (returnTo?: string) => void;
  showAuthModal: boolean;
  closeAuthModal: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingReturnTo, setPendingReturnTo] = useState("/home");

  const login = useCallback((returnTo = "/home") => {
    setPendingReturnTo(returnTo);
    setShowAuthModal(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setShowAuthModal(false);
  }, []);

  const handleAuthSuccess = useCallback(async () => {
    setShowAuthModal(false);
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    navigate(pendingReturnTo);
  }, [queryClient, navigate, pendingReturnTo]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await handleAuthSuccess();
  }, [handleAuthSuccess]);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
    await handleAuthSuccess();
  }, [handleAuthSuccess]);

  return (
    <AuthModalContext.Provider value={{ login, showAuthModal, closeAuthModal, signIn, signUp }}>
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}
