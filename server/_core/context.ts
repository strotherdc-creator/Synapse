import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../shared/schema";
import { getAuth } from "@clerk/express";
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
        await db.upsertUser({
          clerkId: auth.userId,
          lastSignedIn: new Date(),
        });
        const newUser = await db.getUserByClerkId(auth.userId);
        user = newUser ?? null;
      } else {
        // Update last signed in (fire and forget)
        db.upsertUser({
          clerkId: auth.userId,
          lastSignedIn: new Date(),
        }).catch(() => {});
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
