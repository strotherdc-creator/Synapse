import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";

export function useAuth() {
  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useClerkAuth();

  // Once Clerk says we're signed in, fetch the DB user via tRPC
  const { data: dbUser, isLoading: dbLoading } = trpc.auth.me.useQuery(
    undefined,
    {
      enabled: clerkLoaded && isSignedIn === true,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const loading = !clerkLoaded || (isSignedIn && dbLoading);

  return {
    user: isSignedIn ? dbUser ?? null : null,
    clerkUser: clerkUser ?? null,
    loading,
    isAuthenticated: isSignedIn ?? false,
    logout: async () => {
      await signOut();
    },
    refresh: () => {},
  };
}
