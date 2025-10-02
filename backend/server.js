import express from "express";
import cors from "cors";
import fs from "fs";
import { nanoid } from "nanoid";
import multer from "multer";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = "./backend/data.json";

// ====== Helpers ======
const readData = () => {
  if (!fs.existsSync(DATA_FILE)) return { chores: [], users: [] };
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
};
const writeData = (data) =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// ====== Middleware ======
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ====== Multer (photo upload temp handler) ======
const upload = multer({ storage: multer.memoryStorage() });

// ====== Routes ======

// 👥 Get users
app.get("/api/users", (req, res) => {
  const db = readData();
  if (!db.users || db.users.length === 0) db.users = ["Adam", "Mike"]; // default users
  res.json(db.users);
});

// 📋 Get chores within date range
app.get("/api/chores", (req, res) => {
  const db = readData();
  let chores = db.chores || [];
  const { start, end } = req.query;

  if (start && end) {
    chores = chores.filter((c) => c.date >= start && c.date <= end);
  }
  res.json(chores);
});

// ➕ Add new chore or "Make your own"
app.post("/api/chores", (req, res) => {
  const db = readData();
  const { title, assignee, date, type } = req.body;

  if (!date) return res.status(400).json({ error: "Date is required" });

  // Limit Make Your Own to 4 per week
  if (type === "NoDinner") {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
    const start = startOfWeek.toISOString().split("T")[0];
    const end = new Date(startOfWeek.setDate(startOfWeek.getDate() + 6))
      .toISOString()
      .split("T")[0];

    const count = db.chores.filter(
      (c) => c.type === "NoDinner" && c.date >= start && c.date <= end
    ).length;

    if (count >= 4)
      return res
        .status(400)
        .json({
          error: "Limit reached: only 4 'Make your own' days per week.",
        });
  }

  const newItem = {
    id: nanoid(),
    title: title || "Untitled",
    assignee: assignee || "Adam",
    date,
    type: type || "Dinner",
    done: false,
    comments: [],
  };

  db.chores.push(newItem);
  writeData(db);
  res.json(newItem);
});

// ✏️ Update chore
app.put("/api/chores/:id", (req, res) => {
  const db = readData();
  const { id } = req.params;
  const idx = db.chores.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  db.chores[idx] = { ...db.chores[idx], ...req.body };
  writeData(db);
  res.json(db.chores[idx]);
});

// ❌ Delete chore
app.delete("/api/chores/:id", (req, res) => {
  const db = readData();
  const { id } = req.params;
  db.chores = db.chores.filter((c) => c.id !== id);
  writeData(db);
  res.json({ success: true });
});

// 💬 Add comment (with optional photo)
app.post(
  "/api/chores/:id/comment",
  upload.single("photo"),
  async (req, res) => {
    const db = readData();
    const { id } = req.params;
    const { name, text } = req.body;
    const task = db.chores.find((c) => c.id === id);
    if (!task) return res.status(404).json({ error: "Chore not found" });

    let photoUrl = null;
    if (req.file && process.env.CLOUDINARY_UPLOAD_URL) {
      // upload to cloudinary unsigned preset
      const form = new FormData();
      form.append("file", req.file.buffer, req.file.originalname);
      form.append("upload_preset", process.env.CLOUDINARY_PRESET);

      const uploadRes = await fetch(process.env.CLOUDINARY_UPLOAD_URL, {
        method: "POST",
        body: form,
      }).then((r) => r.json());

      photoUrl = uploadRes.secure_url;
    }

    const comment = {
      id: nanoid(),
      name: name || "Anonymous",
      text: text || "",
      photo: photoUrl,
      createdAt: new Date().toISOString(),
    };

    task.comments = task.comments || [];
    task.comments.push(comment);
    writeData(db);

    res.json(comment);
  }
);

// 🍳 Get recipe suggestion
app.get("/api/recipe", async (req, res) => {
  const q = req.query.q || "dinner";
  const resp = await fetch(
    `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(
      q
    )}`
  );
  const data = await resp.json();
  res.json(data);
});

// ====== Start ======
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
