import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { useState } from "react";
import App from "./App";
import "./index.css";

// Clerk publishable key — this is a PUBLIC key (safe to include in client code).
// In local dev, VITE_CLERK_PUBLISHABLE_KEY from .env takes precedence.
// In production Docker builds, the hardcoded fallback is used since Docker ARG
// can mangle the trailing $ in the key value.
const CLERK_PUBLISHABLE_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  "pk_test_cmVzdGVkLW1vbGUtMjguY2xlcmsuYWNjb3VudHMuZGV2JA";

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

/**
 * TRPCProvider wraps the app inside ClerkProvider so it has access to
 * useAuth().getToken(). This is the official Clerk pattern for sending
 * session tokens with API requests in a React SPA.
 *
 * The tRPC client sends the Clerk JWT as a Bearer token in the
 * Authorization header on every request. The Express server's
 * clerkMiddleware() + getAuth() reads this token to identify the user.
 */
function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useClerkAuth();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
          async headers() {
            const token = await getToken();
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
    <TRPCProvider>
      <App />
    </TRPCProvider>
  </ClerkProvider>
);
