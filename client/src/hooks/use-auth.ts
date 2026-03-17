import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User as DBUser } from "@shared/models/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Extend DBUser with SupabaseUser, prioritizing DB fields but allowing undefined equivalents
export type CombinedUser = DBUser & {
  supabaseUser?: SupabaseUser;
};

export function useAuth() {
  const queryClient = useQueryClient();
  const [sessionUser, setSessionUser] = useState<SupabaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // 1. Listen to Supabase Auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionUser(session?.user ?? null);
      setIsAuthLoading(false); // Done loading initial auth state
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSessionUser(session?.user ?? null);
      setIsAuthLoading(false);
      if (!session) {
        // Clear DB user cache on sign out
        queryClient.setQueryData(["/api/auth/user"], null);
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  // 2. Fetch the rich user profile from the database based on the Auth user
  // This allows us to keep the `quizCompleted`, `role`, etc., available for the frontend.
  const { data: dbUser, isLoading: isDbUserLoading } = useQuery<DBUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      // If we don't have a supabase session, we shouldn't fetch the backend profile yet
      if (!session) return null;

      // We send the Supabase JWT token in the Authorization header to the backend
      const response = await fetch("/api/auth/user", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) return null;
        throw new Error("Failed to fetch user profile");
      }
      return response.json();
    },
    enabled: !!sessionUser, 
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await supabase.auth.signOut();
    },
  });

  // Construct our combined user prioritizing DBUser data, falling back to SupabaseUser for ID/Email if needed before DB loads
  let combinedUser: CombinedUser | null = null;
  
  if (dbUser) {
    combinedUser = { ...dbUser, supabaseUser: sessionUser || undefined };
  } else if (sessionUser) {
     // Create a dummy DBUser to satisfy the type until the real DBUser loads
     combinedUser = {
        id: sessionUser.id,
        email: sessionUser.email || null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
        bio: null,
        city: null,
        role: "user",
        quizCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        supabaseUser: sessionUser
     };
  }

  // We are fully loaded once BOTH Supabase state is detected AND the db profile (if logged in) is fetched
  // React Query's `isPending` is better than `isLoading` here, but we can also just check if we have the combinedUser
  const isLoading = isAuthLoading || (!!sessionUser && isDbUserLoading && !dbUser);

  return {
    user: combinedUser,
    isLoading,
    isAuthenticated: !!sessionUser,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
