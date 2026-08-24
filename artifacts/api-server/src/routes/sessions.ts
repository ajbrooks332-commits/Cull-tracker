import { Router, type IRouter } from "express";
import { db, stalkingSessionsTable, stalkersTable } from "@workspace/db";
import { insertSessionSchema, updateSessionSchema } from "@workspace/db/schema";
import { and, between, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/session.js";

const router: IRouter = Router();

function seasonDateRange(startYear: number) {
  return {
    start: new Date(startYear, 4, 1),
    end: new Date(startYear + 1, 3, 30, 23, 59, 59, 999),
  };
}

function validIntParam(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function safeSession(row: typeof stalkingSessionsTable.$inferSelect & { stalkerName?: string | null }) {
  return {
    id: row.id,
    stalkerId: row.stalkerId,
    stalkerName: row.stalkerName ?? null,
    woodlandBlock: row.woodlandBlock,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationMinutes: row.durationMinutes,
    weather: row.weather,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.get("/sessions", requireAuth, async (req, res) => {
  try {
    const stalkerId = validIntParam(req.query.stalkerId as string);
    const season    = validIntParam(req.query.season as string);

    const filters = [];
    if (stalkerId !== null) filters.push(eq(stalkingSessionsTable.stalkerId, stalkerId));
    if (season !== null) {
      const { start, end } = seasonDateRange(season);
      filters.push(between(stalkingSessionsTable.startedAt, start, end));
    }

    const rows = await db
      .select({
        id:              stalkingSessionsTable.id,
        stalkerId:       stalkingSessionsTable.stalkerId,
        stalkerName:     stalkersTable.name,
        woodlandBlock:   stalkingSessionsTable.woodlandBlock,
        startedAt:       stalkingSessionsTable.startedAt,
        endedAt:         stalkingSessionsTable.endedAt,
        durationMinutes: stalkingSessionsTable.durationMinutes,
        weather:         stalkingSessionsTable.weather,
        notes:           stalkingSessionsTable.notes,
        isActive:        stalkingSessionsTable.isActive,
        createdAt:       stalkingSessionsTable.createdAt,
        updatedAt:       stalkingSessionsTable.updatedAt,
      })
      .from(stalkingSessionsTable)
      .leftJoin(stalkersTable, eq(stalkingSessionsTable.stalkerId, stalkersTable.id))
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(stalkingSessionsTable.startedAt));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

router.post("/sessions", requireAuth, async (req, res) => {
  try {
    const body = {
      ...req.body,
      startedAt: req.body.startedAt ? new Date(req.body.startedAt) : undefined,
      endedAt:   req.body.endedAt   ? new Date(req.body.endedAt)   : undefined,
    };
    const parsed = insertSessionSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const [inserted] = await db.insert(stalkingSessionsTable).values(parsed.data).returning();
    const [stalker]  = inserted.stalkerId
      ? await db.select().from(stalkersTable).where(eq(stalkersTable.id, inserted.stalkerId))
      : [];
    res.status(201).json(safeSession({ ...inserted, stalkerName: stalker?.name ?? null }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.put("/sessions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const body = {
      ...req.body,
      startedAt: req.body.startedAt ? new Date(req.body.startedAt) : undefined,
      endedAt:   req.body.endedAt   ? new Date(req.body.endedAt)   : undefined,
    };
    const parsed = updateSessionSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const [updated] = await db
      .update(stalkingSessionsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(stalkingSessionsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [stalker] = updated.stalkerId
      ? await db.select().from(stalkersTable).where(eq(stalkersTable.id, updated.stalkerId))
      : [];
    res.json(safeSession({ ...updated, stalkerName: stalker?.name ?? null }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update session" });
  }
});

router.delete("/sessions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [deleted] = await db
      .delete(stalkingSessionsTable)
      .where(eq(stalkingSessionsTable.id, id))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

export default router;
