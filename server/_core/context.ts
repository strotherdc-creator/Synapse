import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../shared/schema";
import { clerkClient, getAuth } from "@clerk/express";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const auth = getAuth(opts.req);

    if (auth?.userId) {
      const foundUser = await db.getUserByClerkId(auth.userId);
      user = foundUser ?? null;

      // Auto-create user on first visit
      if (!user) {
        // Fetch full user details from Clerk to get email/name
        const clerkUser = await clerkClient.users.getUser(auth.userId);
        const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null;
        const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

        await db.upsertUser({
          clerkId: auth.userId,
          email: email ?? undefined,
          name: name ?? undefined,
          lastSignedIn: new Date(),
        });
        const newUser = await db.getUserByClerkId(auth.userId);
        user = newUser ?? null;
      } else {
        // Update last signed in + pass email for admin promotion check
        const email = user.email;
        if (!email) {
          // If we don't have email stored yet, fetch from Clerk
          try {
            const clerkUser = await clerkClient.users.getUser(auth.userId);
            const clerkEmail = clerkUser.emailAddresses?.[0]?.emailAddress ?? null;
            if (clerkEmail) {
              await db.upsertUser({
                clerkId: auth.userId,
                email: clerkEmail,
                lastSignedIn: new Date(),
              });
              // Re-fetch user to get updated role
              const updatedUser = await db.getUserByClerkId(auth.userId);
              user = updatedUser ?? user;
            }
          } catch {
            // Non-critical, continue with existing user
          }
        } else {
          // Email exists — refresh lastSignedIn (also re-checks admin promotion),
          // but only when it's actually stale. Every tRPC request creates a new
          // context, and pages fire several parallel calls per navigation, so
          // writing on every request would mean two DB round trips (select +
          // update) just to bump a timestamp that barely changed.
          const staleMs = 5 * 60 * 1000; // 5 minutes
          const lastSignedIn = user.lastSignedIn ? new Date(user.lastSignedIn).getTime() : 0;
          if (Date.now() - lastSignedIn > staleMs) {
            db.upsertUser({
              clerkId: auth.userId,
              email,
              lastSignedIn: new Date(),
            }).catch(() => {});
          }
        }
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
