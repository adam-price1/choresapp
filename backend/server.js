// backend/server.js
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import { v2 as cloudinary } from "cloudinary";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Fixed path (works on Render)
const DATA_FILE = path.join(__dirname, "data.json");

// 🧠 Load or initialize
function readData() {
  try {
    const text = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(text);
  } catch {
    return { chores: [], comments: [], users: ["Adam", "Mike"] };
  }
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Configure Cloudinary (optional)
cloudinary.config({
  cloud_name: process.env.VITE_CLOUD_NAME,
  api_key: process.env.VITE_CLOUD_KEY,
  api_secret: process.env.VITE_CLOUD_SECRET,
});

const upload = multer({ dest: "uploads/" });

/* ---------- API ROUTES ---------- */

app.get("/api/users", (req, res) => {
  const data = readData();
  res.json(data.users);
});

app.get("/api/chores", (req, res) => {
  const data = readData();
  const { start, end } = req.query;
  let filtered = data.chores;
  if (start && end) {
    filtered = filtered.filter((t) => t.date >= start && t.date <= end);
  }
  res.json(filtered);
});

app.post("/api/chores", (req, res) => {
  const data = readData();
  const newItem = {
    id: Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
    ...req.body,
  };
  data.chores.push(newItem);
  writeData(data);
  res.json(newItem);
});

app.put("/api/chores/:id", (req, res) => {
  const data = readData();
  const t = data.chores.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Not found" });
  Object.assign(t, req.body);
  writeData(data);
  res.json(t);
});

app.delete("/api/chores/:id", (req, res) => {
  const data = readData();
  data.chores = data.chores.filter((x) => x.id !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

// 💬 Comment endpoint (with optional photo upload)
app.post("/api/comments", upload.single("photo"), async (req, res) => {
  const data = readData();
  let photoUrl = null;

  if (
    req.file &&
    process.env.VITE_CLOUD_NAME &&
    process.env.VITE_CLOUD_PRESET
  ) {
    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        upload_preset: process.env.VITE_CLOUD_PRESET,
      });
      photoUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    } catch (e) {
      console.error("Cloudinary error:", e.message);
    }
  }

  const newComment = {
    id: Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
    ...req.body,
    photoUrl,
  };
  data.comments.push(newComment);
  writeData(data);
  res.json(newComment);
});

/* ---------- SERVER ---------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
