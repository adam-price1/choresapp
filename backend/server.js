// backend/server.js
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { fileURLToPath } from "url";

// ===== Setup =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "data.json");

// Cloudinary config (from your .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer (for parsing uploads)
const upload = multer({ storage: multer.memoryStorage() });

// ===== Helpers for JSON store =====
function readData() {
  try {
    const txt = fs.readFileSync(DATA_FILE, "utf8");
    const db = JSON.parse(txt);
    if (!db.users) db.users = ["Adam", "Mike"];
    if (!db.chores) db.chores = [];
    if (!db.comments) db.comments = [];
    return db;
  } catch {
    const seed = { users: ["Adam", "Mike"], chores: [], comments: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ===== App =====
const app = express();
app.use(cors());
app.use(express.json());

// ---- Health check ----
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ---- Users ----
app.get("/api/users", (_req, res) => res.json(readData().users));

// ---- Chores ----
app.get("/api/chores", (req, res) => {
  const { start, end } = req.query;
  let items = readData().chores;
  if (start && end) {
    items = items.filter((t) => t.date >= start && t.date <= end);
  }
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

// ---- Comments (with optional photo upload) ----
app.get("/api/comments", (_req, res) => res.json(readData().comments));

app.post("/api/comments", upload.single("photo"), async (req, res) => {
  const db = readData();
  if (!db.comments) db.comments = [];

  let photoUrl = null;
  if (req.file) {
    try {
      // upload buffer to cloudinary
      const uploadResult = await cloudinary.uploader.upload_stream(
        { resource_type: "image" },
        (error, result) => {
          if (error) console.error("Cloudinary upload error:", error);
          photoUrl = result?.secure_url || null;

          // Save comment once upload done
          const comment = {
            id: Math.random().toString(36).slice(2),
            createdAt: new Date().toISOString(),
            name: req.body.name ?? "",
            anonymous: !!req.body.anonymous,
            text: req.body.text ?? "",
            date: req.body.date ?? new Date().toISOString().slice(0, 10),
            photoUrl,
          };
          db.comments.push(comment);
          writeData(db);
          res.json(comment);
        }
      );

      // Pipe file buffer into Cloudinary upload
      uploadResult.end(req.file.buffer);
      return;
    } catch (err) {
      return res.status(500).json({ error: "Photo upload failed" });
    }
  }

  // If no photo
  const comment = {
    id: Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
    name: req.body.name ?? "",
    anonymous: !!req.body.anonymous,
    text: req.body.text ?? "",
    date: req.body.date ?? new Date().toISOString().slice(0, 10),
    photoUrl: null,
  };

  db.comments.push(comment);
  writeData(db);
  res.json(comment);
});

// ===== Start server =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
