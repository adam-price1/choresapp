import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "data.json");

// Cloudinary setup
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer temp storage
const upload = multer({ dest: "uploads/" });

// ---- Helpers ----
function readData() {
  try {
    const txt = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(txt);
  } catch {
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

// ---- Comments ----
app.post("/api/comments", upload.single("photo"), async (req, res) => {
  const db = readData();

  let photoUrl = null;
  if (req.file) {
    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        upload_preset: "unsigned_upload", // 👈 use your preset
      });
      photoUrl = result.secure_url;
      fs.unlinkSync(req.file.path); // cleanup temp file
    } catch (err) {
      console.error("Cloudinary upload failed:", err.message);
      return res.status(500).json({ error: "Image upload failed" });
    }
  }

  const comment = {
    id: Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
    name: req.body.name || "",
    anonymous: req.body.isAnonymous === "true",
    text: req.body.text || "",
    date: req.body.date || new Date().toISOString().slice(0, 10),
    photoUrl, // ✅ now saved
  };

  db.comments.push(comment);
  writeData(db);
  res.json(comment);
});
