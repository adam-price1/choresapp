// backend/server.js
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "data.json");

// ---- tiny JSON store helpers ----
function readData() {
  try {
    const txt = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(txt);
  } catch {
    // first run: create file
    const seed = { users: ["Adam", "Mike"], chores: [], comments: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const app = express();
app.use(cors());
app.use(express.json());

// ---- health ----
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ---- users ----
app.get("/api/users", (_req, res) => res.json(readData().users));

// ---- chores ----
app.get("/api/chores", (req, res) => {
  const { start, end } = req.query;
  let items = readData().chores;
  if (start && end)
    items = items.filter((t) => t.date >= start && t.date <= end);
  res.json(items);
});

app.post("/api/chores", (req, res) => {
  const db = readData();
  const item = {
    id: Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
    ...req.body,
  };
  db.chores.push(item);
  writeData(db);
  res.json(item);
});

app.put("/api/chores/:id", (req, res) => {
  const db = readData();
  const t = db.chores.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Not found" });
  Object.assign(t, req.body);
  writeData(db);
  res.json(t);
});

app.delete("/api/chores/:id", (req, res) => {
  const db = readData();
  db.chores = db.chores.filter((x) => x.id !== req.params.id);
  writeData(db);
  res.json({ success: true });
});

// ---- comments ----
app.get("/api/comments", (_req, res) => res.json(readData().comments));
app.post("/api/comments", (req, res) => {
  const db = readData();
  const comment = {
    id: Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
    name: req.body.name ?? "",
    isAnonymous: !!req.body.isAnonymous,
    text: req.body.text ?? "",
    date: req.body.date ?? new Date().toISOString().slice(0, 10),
    photo: req.body.photo || null, // frontend already uploads to Cloudinary
  };
  db.comments.push(comment);
  writeData(db);
  res.json(comment);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
