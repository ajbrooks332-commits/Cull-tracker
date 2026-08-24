import { Router, type IRouter } from "express";
import { db, cullsTable, stalkersTable, cullPlansTable } from "@workspace/db";
import {
  insertCullSchema,
  updateCullSchema,
  insertCullPlanSchema,
  updateCullPlanSchema,
} from "@workspace/db/schema";
import { and, between, eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/session.js";

function coerceDates(body: Record<string, unknown>) {
  const out = { ...body };
  for (const key of ["culledAt"] as const) {
    if (typeof out[key] === "string") out[key] = new Date(out[key] as string);
  }
  return out;
}

const router: IRouter = Router();

function seasonDateRange(startYear: number): { start: Date; end: Date } {
  return {
    start: new Date(startYear, 4, 1),
    end: new Date(startYear + 1, 3, 30, 23, 59, 59, 999),
  };
}

function validIntParam(val: string | undefined): number | null {
  if (!val) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

router.get("/culls", async (req, res) => {
  try {
    const stalkerId = validIntParam(req.query.stalkerId as string);
    const seasonStart = validIntParam(req.query.season as string);

    const filters = [];
    if (stalkerId !== null) filters.push(eq(cullsTable.stalkerId, stalkerId));
    if (seasonStart !== null) {
      const { start, end } = seasonDateRange(seasonStart);
      filters.push(between(cullsTable.culledAt, start, end));
    }

    const rows = await db
      .select({
        id: cullsTable.id,
        stalkerId: cullsTable.stalkerId,
        stalkerName: stalkersTable.name,
        sessionId: cullsTable.sessionId,
        species: cullsTable.species,
        sex: cullsTable.sex,
        weight: cullsTable.weight,
        condition: cullsTable.condition,
        pregnant: cullsTable.pregnant,
        latitude: cullsTable.latitude,
        longitude: cullsTable.longitude,
        woodlandBlock: cullsTable.woodlandBlock,
        larderTag: cullsTable.larderTag,
        notes: cullsTable.notes,
        culledAt: cullsTable.culledAt,
        createdAt: cullsTable.createdAt,
        updatedAt: cullsTable.updatedAt,
      })
      .from(cullsTable)
      .leftJoin(stalkersTable, eq(cullsTable.stalkerId, stalkersTable.id))
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(cullsTable.culledAt);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch culls" });
  }
});

router.post("/culls", async (req, res) => {
  try {
    const parsed = insertCullSchema.safeParse(coerceDates(req.body));
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const [inserted] = await db.insert(cullsTable).values(parsed.data).returning();
    const [stalker] = inserted.stalkerId
      ? await db.select().from(stalkersTable).where(eq(stalkersTable.id, inserted.stalkerId))
      : [];
    res.status(201).json({ ...inserted, stalkerName: stalker?.name ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create cull" });
  }
});

router.get("/culls/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [row] = await db
      .select({
        id: cullsTable.id,
        stalkerId: cullsTable.stalkerId,
        stalkerName: stalkersTable.name,
        sessionId: cullsTable.sessionId,
        species: cullsTable.species,
        sex: cullsTable.sex,
        weight: cullsTable.weight,
        condition: cullsTable.condition,
        pregnant: cullsTable.pregnant,
        latitude: cullsTable.latitude,
        longitude: cullsTable.longitude,
        woodlandBlock: cullsTable.woodlandBlock,
        larderTag: cullsTable.larderTag,
        notes: cullsTable.notes,
        culledAt: cullsTable.culledAt,
        createdAt: cullsTable.createdAt,
        updatedAt: cullsTable.updatedAt,
      })
      .from(cullsTable)
      .leftJoin(stalkersTable, eq(cullsTable.stalkerId, stalkersTable.id))
      .where(eq(cullsTable.id, id));

    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch cull" });
  }
});

router.put("/culls/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const parsed = updateCullSchema.safeParse(coerceDates(req.body));
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const [updated] = await db
      .update(cullsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(cullsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    const [stalker] = updated.stalkerId
      ? await db.select().from(stalkersTable).where(eq(stalkersTable.id, updated.stalkerId))
      : [];
    res.json({ ...updated, stalkerName: stalker?.name ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update cull" });
  }
});

router.delete("/culls/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [cull] = await db.delete(cullsTable).where(eq(cullsTable.id, id)).returning();
    if (!cull) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete cull" });
  }
});

// ── Cull plans (estate targets) ────────────────────────────────────────────

router.get("/cull-plans", async (req, res) => {
  try {
    const seasonStartParam = req.query.seasonStart;
    const filters = [];
    if (typeof seasonStartParam === "string") {
      const seasonStart = parseInt(seasonStartParam, 10);
      if (!isNaN(seasonStart)) filters.push(eq(cullPlansTable.seasonStartYear, seasonStart));
    }
    const rows = await db
      .select()
      .from(cullPlansTable)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(cullPlansTable.species, cullPlansTable.sex);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch cull plans" });
  }
});

router.post("/cull-plans", requireAdmin, async (req, res) => {
  try {
    const parsed = insertCullPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const [row] = await db.insert(cullPlansTable).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create cull plan" });
  }
});

router.put("/cull-plans/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const parsed = updateCullPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const [row] = await db
      .update(cullPlansTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(cullPlansTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update cull plan" });
  }
});

router.delete("/cull-plans/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [row] = await db.delete(cullPlansTable).where(eq(cullPlansTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete cull plan" });
  }
});

export default router;
