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
    const path = opts.req.path || opts.req.url;
    
    // Diagnostic logging for auth debugging
    if (path.includes('auth.me')) {
      console.log('[Auth Debug] auth.me request received');
      console.log('[Auth Debug] auth object:', JSON.stringify({
        userId: auth?.userId ?? null,
        sessionId: auth?.sessionId ?? null,
        orgId: auth?.orgId ?? null,
      }));
      console.log('[Auth Debug] Authorization header present:', !!opts.req.headers.authorization);
      console.log('[Auth Debug] Cookie header present:', !!opts.req.headers.cookie);
      if (opts.req.headers.cookie) {
        const cookieNames = opts.req.headers.cookie.split(';').map(c => c.trim().split('=')[0]);
        console.log('[Auth Debug] Cookie names:', cookieNames);
      }
    }
    
    if (auth?.userId) {
      const foundUser = await db.getUserByClerkId(auth.userId);
      user = foundUser ?? null;

      // Auto-create user on first visit
      if (!user) {
        console.log('[Auth Debug] Creating new user for clerkId:', auth.userId);
        await db.upsertUser({
          clerkId: auth.userId,
          lastSignedIn: new Date(),
        });
        const newUser = await db.getUserByClerkId(auth.userId);
        user = newUser ?? null;
        console.log('[Auth Debug] New user created:', user ? 'success' : 'failed');
      } else {
        // Update last signed in (fire and forget)
        db.upsertUser({
          clerkId: auth.userId,
          lastSignedIn: new Date(),
        }).catch(() => {});
      }
      
      if (path.includes('auth.me')) {
        console.log('[Auth Debug] Returning user:', user ? { id: user.id, email: user.email, role: user.role } : null);
      }
    } else if (path.includes('auth.me')) {
      console.log('[Auth Debug] No userId found in auth — returning null user');
    }
  } catch (error) {
    console.error('[Auth Debug] Error in createContext:', error);
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
