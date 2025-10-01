import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import { db } from "./db.js"; // <-- our MySQL connection

const app = express();
const PORT = process.env.PORT || 5001;

/** CORS: allow your domains */
app.use(
  cors({
    origin: [
      "https://websitebuildexample4.online",
      "https://www.websitebuildexample4.online",
      "http://localhost:5173", // keep for local dev
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(express.json());

/* --------- Routes --------- */

// Health check (useful for testing the app URL)
app.get("/", (_, res) => res.send("OK"));

/** Get users (Adam/Mike seeded in DB) */
app.get("/api/users", async (_, res) => {
  try {
    const [rows] = await db.query("SELECT name FROM users");
    res.json(rows.map((r) => r.name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db error" });
  }
});

/** Get chores; optional weekly range ?start=YYYY-MM-DD&end=YYYY-MM-DD */
app.get("/api/chores", async (req, res) => {
  try {
    const { start, end } = req.query;
    let sql = "SELECT * FROM chores";
    const params = [];
    if (start && end) {
      sql += " WHERE date BETWEEN ? AND ?";
      params.push(start, end);
    }
    sql += " ORDER BY date, createdAt";
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db error" });
  }
});

/** Create chore */
app.post("/api/chores", async (req, res) => {
  try {
    const { title, assignee, type = "Other" } = req.body;
    const date = req.body.date || req.body.dueDate; // backward-compat

    if (!date) return res.status(400).json({ error: "date required" });
    if (type !== "NoDinner" && (!title || !assignee)) {
      return res
        .status(400)
        .json({ error: "title and assignee required (except NoDinner)" });
    }

    // Enforce: at most 2 "Make your own" per ISO week (Mon–Sun)
    if (type === "NoDinner") {
      const [r] = await db.query(
        "SELECT COUNT(*) AS cnt FROM chores WHERE type='NoDinner' AND YEARWEEK(date, 1)=YEARWEEK(?, 1)",
        [date]
      );
      if (r[0].cnt >= 2) {
        return res.status(400).json({
          error: "Limit reached: only 2 'Make your own' days allowed per week.",
        });
      }
    }

    const id = nanoid();
    const finalTitle = type === "NoDinner" ? "Make your own" : title;
    const finalAssignee = type === "NoDinner" ? "" : assignee;

    await db.query(
      "INSERT INTO chores (id, title, assignee, date, type, done) VALUES (?, ?, ?, ?, ?, ?)",
      [id, finalTitle, finalAssignee, date, type, 0]
    );

    res.status(201).json({
      id,
      title: finalTitle,
      assignee: finalAssignee,
      date,
      type,
      done: 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db error" });
  }
});

/** Update chore (partial) */
app.put("/api/chores/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // normalize dueDate -> date
    if (updates.dueDate && !updates.date) updates.date = updates.dueDate;
    delete updates.dueDate;

    // If changing/moving to NoDinner, re-check the 2-per-week rule
    if (updates.type === "NoDinner" || updates.date) {
      // fetch current record
      const [currRows] = await db.query("SELECT * FROM chores WHERE id=?", [
        id,
      ]);
      if (!currRows.length) return res.status(404).json({ error: "Not found" });

      const current = currRows[0];
      const next = { ...current, ...updates };
      if (next.type === "NoDinner") {
        const [r] = await db.query(
          "SELECT COUNT(*) AS cnt FROM chores WHERE id<>? AND type='NoDinner' AND YEARWEEK(date,1)=YEARWEEK(?,1)",
          [id, next.date]
        );
        if (r[0].cnt >= 2) {
          return res.status(400).json({
            error:
              "Limit reached: only 2 'Make your own' days allowed per week.",
          });
        }
      }
    }

    // Build dynamic SET clause
    const set = [];
    const vals = [];
    for (const k of Object.keys(updates)) {
      set.push(`${k}=?`);
      vals.push(updates[k]);
    }
    if (!set.length) return res.json({ ok: true });

    vals.push(id);
    await db.query(`UPDATE chores SET ${set.join(", ")} WHERE id=?`, vals);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db error" });
  }
});

/** Delete chore */
app.delete("/api/chores/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM chores WHERE id=?", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db error" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
