import { Router, type IRouter } from "express";
import { db, stalkersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSession, requireAdmin } from "../middlewares/session.js";

const router: IRouter = Router();

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const BCRYPT_ROUNDS = 12;

const pinSchema = z
  .string()
  .regex(/^\d{4}$/, "PIN must be exactly 4 digits");

function safeStalker(s: typeof stalkersTable.$inferSelect) {
  return { id: s.id, name: s.name, isAdmin: s.isAdmin, createdAt: s.createdAt };
}


router.get("/stalkers", async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const stalkers = await db
      .select({
        id: stalkersTable.id,
        name: stalkersTable.name,
        isAdmin: stalkersTable.isAdmin,
        createdAt: stalkersTable.createdAt,
      })
      .from(stalkersTable)
      .orderBy(stalkersTable.name);
    res.json(stalkers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stalkers" });
  }
});

router.post("/stalkers/login", async (req, res) => {
  try {
    const { name, pin } = req.body as { name?: string; pin?: string };
    if (!name || !pin) {
      res.status(400).json({ error: "Name and PIN are required" });
      return;
    }

    const pinValidation = pinSchema.safeParse(pin);
    if (!pinValidation.success) {
      res.status(400).json({ error: "PIN must be exactly 4 digits" });
      return;
    }

    const [stalker] = await db
      .select()
      .from(stalkersTable)
      .where(eq(stalkersTable.name, name));

    if (!stalker) {
      res.status(400).json({ error: "Invalid name or PIN" });
      return;
    }

    if (stalker.lockedUntil && stalker.lockedUntil > new Date()) {
      const secsRemaining = Math.ceil((stalker.lockedUntil.getTime() - Date.now()) / 1000);
      const mins = Math.ceil(secsRemaining / 60);
      res.status(423).json({
        error: `Account locked. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`,
        lockedUntil: stalker.lockedUntil.toISOString(),
      });
      return;
    }

    const valid = await bcrypt.compare(pin, stalker.pin);

    if (!valid) {
      const newFailed = (stalker.failedAttempts ?? 0) + 1;
      const shouldLock = newFailed >= LOCK_THRESHOLD;
      await db
        .update(stalkersTable)
        .set({
          failedAttempts: newFailed,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
        })
        .where(eq(stalkersTable.id, stalker.id));

      const remaining = LOCK_THRESHOLD - newFailed;
      if (shouldLock) {
        res.status(423).json({
          error: `Account locked for 15 minutes after too many failed attempts.`,
        });
      } else {
        res.status(400).json({
          error: `Incorrect PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lockout.`,
          attemptsRemaining: remaining,
        });
      }
      return;
    }

    await db
      .update(stalkersTable)
      .set({ failedAttempts: 0, lockedUntil: null })
      .where(eq(stalkersTable.id, stalker.id));

    const token = await createSession(stalker.id, stalker.name, stalker.isAdmin);

    res.json({
      ...safeStalker(stalker),
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/stalkers/bootstrap", async (req, res) => {
  try {
    const count = await db.select({ id: stalkersTable.id }).from(stalkersTable);
    if (count.length > 0) {
      res.status(403).json({ error: "Bootstrap is only available when no accounts exist" });
      return;
    }
    const bodySchema = z.object({
      name: z.string().min(1).max(100),
      pin: pinSchema,
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const passwordHash = await bcrypt.hash(parsed.data.pin, BCRYPT_ROUNDS);
    const [stalker] = await db
      .insert(stalkersTable)
      .values({ name: parsed.data.name, pin: passwordHash, isAdmin: true })
      .returning();
    const token = await createSession(stalker.id, stalker.name, stalker.isAdmin);
    res.status(201).json({ ...safeStalker(stalker), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

router.post("/stalkers", requireAdmin, async (req, res) => {
  try {
    const bodySchema = z.object({
      name: z.string().min(1).max(100),
      pin: pinSchema,
      isAdmin: z.boolean().optional(),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const [existing] = await db
      .select()
      .from(stalkersTable)
      .where(eq(stalkersTable.name, parsed.data.name));
    if (existing) {
      res.status(409).json({ error: "A stalker with that name already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.pin, BCRYPT_ROUNDS);
    const [stalker] = await db
      .insert(stalkersTable)
      .values({ name: parsed.data.name, pin: passwordHash, isAdmin: parsed.data.isAdmin ?? false })
      .returning();
    res.status(201).json(safeStalker(stalker));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create stalker" });
  }
});

router.put("/stalkers/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const bodySchema = z.object({
      name: z.string().min(1).max(100).optional(),
      pin: pinSchema.optional(),
      isAdmin: z.boolean().optional(),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) update.name = parsed.data.name;
    if (parsed.data.isAdmin !== undefined) update.isAdmin = parsed.data.isAdmin;
    if (parsed.data.pin !== undefined) {
      update.pin = await bcrypt.hash(parsed.data.pin, BCRYPT_ROUNDS);
    }

    const [stalker] = await db
      .update(stalkersTable)
      .set(update)
      .where(eq(stalkersTable.id, id))
      .returning();
    if (!stalker) { res.status(404).json({ error: "Not found" }); return; }
    res.json(safeStalker(stalker));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update stalker" });
  }
});

router.delete("/stalkers/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [stalker] = await db
      .delete(stalkersTable)
      .where(eq(stalkersTable.id, id))
      .returning();
    if (!stalker) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete stalker" });
  }
});

export default router;
