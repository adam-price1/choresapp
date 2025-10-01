import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(cors());
app.use(express.json());

// bootstrap data file
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ users: ["Adam", "Mike"], chores: [] }, null, 2)
  );
}

const readData = () => JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
const writeData = (d) =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));

/** helpers **/
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfWeekMon = (dateStr) => {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 Sun..6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};
const endOfWeekSun = (dateStr) => {
  const start = startOfWeekMon(dateStr);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
};

/* ---------- Routes ---------- */
app.get("/api/users", (_, res) => res.json(readData().users));

app.get("/api/chores", (req, res) => {
  const { start, end } = req.query; // YYYY-MM-DD
  let { chores } = readData();
  if (start && end)
    chores = chores.filter((c) => c.date >= start && c.date <= end);
  res.json(chores);
});

app.post("/api/chores", (req, res) => {
  const { title, assignee, type = "Other" } = req.body;
  const date = req.body.date || req.body.dueDate;

  if (!date)
    return res.status(400).json({ error: "date (or dueDate) required" });
  if (type !== "NoDinner" && (!title || !assignee)) {
    return res
      .status(400)
      .json({ error: "title and assignee required (except NoDinner)" });
  }

  // Enforce: at most 2 "NoDinner" per calendar week (Mon–Sun)
  if (type === "NoDinner") {
    const data = readData();
    const start = toYMD(startOfWeekMon(date));
    const end = toYMD(endOfWeekSun(date));
    const countThisWeek = data.chores.filter(
      (c) => c.type === "NoDinner" && c.date >= start && c.date <= end
    ).length;
    if (countThisWeek >= 2) {
      return res.status(400).json({
        error: "Limit reached: only 2 'Make your own' days allowed per week.",
      });
    }
  }

  const data = readData();
  const newChore = {
    id: nanoid(),
    title: type === "NoDinner" ? "Make your own" : title,
    assignee: type === "NoDinner" ? "" : assignee,
    date, // YYYY-MM-DD
    type, // Dinner | Other | NoDinner
    done: false,
    createdAt: new Date().toISOString(),
  };
  data.chores.push(newChore);
  writeData(data);
  res.status(201).json(newChore);
});

app.put("/api/chores/:id", (req, res) => {
  const { id } = req.params;
  const data = readData();
  const i = data.chores.findIndex((c) => c.id === id);
  if (i === -1) return res.status(404).json({ error: "Not found" });

  const updates = { ...req.body };
  if (updates.dueDate && !updates.date) updates.date = updates.dueDate;
  delete updates.dueDate;

  // Re-check the 2-per-week rule if turning into / moving a NoDinner
  const next = { ...data.chores[i], ...updates };
  if (next.type === "NoDinner") {
    const start = toYMD(startOfWeekMon(next.date));
    const end = toYMD(endOfWeekSun(next.date));
    const countThisWeek = data.chores.filter(
      (c) =>
        c.id !== id && c.type === "NoDinner" && c.date >= start && c.date <= end
    ).length;
    if (countThisWeek >= 2) {
      return res.status(400).json({
        error: "Limit reached: only 2 'Make your own' days allowed per week.",
      });
    }
  }

  data.chores[i] = next;
  writeData(data);
  res.json(data.chores[i]);
});

app.delete("/api/chores/:id", (req, res) => {
  const { id } = req.params;
  const data = readData();
  const before = data.chores.length;
  data.chores = data.chores.filter((c) => c.id !== id);
  if (data.chores.length === before)
    return res.status(404).json({ error: "Not found" });
  writeData(data);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
