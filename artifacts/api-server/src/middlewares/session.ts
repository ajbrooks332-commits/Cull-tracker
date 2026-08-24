import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db, authTokensTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

interface SessionData {
  stalkerId: number;
  stalkerName: string;
  isAdmin: boolean;
  expiresAt: number;
}

setInterval(async () => {
  try {
    await db.delete(authTokensTable).where(lt(authTokensTable.expiresAt, new Date()));
  } catch { /* ignore */ }
}, 15 * 60 * 1000);

export async function createSession(stalkerId: number, stalkerName: string, isAdmin: boolean): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(authTokensTable).values({ token, stalkerId, stalkerName, isAdmin, expiresAt });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(authTokensTable).where(eq(authTokensTable.token, token));
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const token = header.slice(7);

  (async () => {
    const [row] = await db.select().from(authTokensTable).where(eq(authTokensTable.token, token));
    if (!row) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }
    if (row.expiresAt < new Date()) {
      await db.delete(authTokensTable).where(eq(authTokensTable.token, token));
      res.status(401).json({ error: "Session expired" });
      return;
    }
    const newExpiry = new Date(Date.now() + SESSION_TTL_MS);
    await db
      .update(authTokensTable)
      .set({ expiresAt: newExpiry })
      .where(eq(authTokensTable.token, token));

    const session: SessionData = {
      stalkerId: row.stalkerId,
      stalkerName: row.stalkerName,
      isAdmin: row.isAdmin,
      expiresAt: newExpiry.getTime(),
    };
    (req as any).session = session;
    next();
  })().catch((err) => {
    console.error("requireAuth error:", err);
    res.status(500).json({ error: "Authentication check failed" });
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    const session = (req as any).session as SessionData;
    if (!session.isAdmin) {
      res.status(403).json({ error: "Administrator access required" });
      return;
    }
    next();
  });
}
