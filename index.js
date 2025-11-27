// index.js
import express from "express";
import multer from "multer";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
const upload = multer({ dest: "uploads/" });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  { global: { fetch: (...args) => fetch(...args) } } // obligatoire pour Render Node 20+
);

// POST /upload-audio
app.post("/upload-audio", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });

  try {
    const fileName = `${Date.now()}_${req.file.originalname}`;
    const fileStream = fs.createReadStream(req.file.path);

    // Upload vers Supabase Storage avec l'option duplex
    const { data, error } = await supabase.storage
      .from("audios")
      .upload(fileName, fileStream, {
        contentType: req.file.mimetype,
        upsert: true,
        duplex: "half", // ✅ la clé pour Node 20+
      });

    fs.unlinkSync(req.file.path); // supprimer le fichier temporaire
    if (error) return res.status(500).json({ error: error.message });

    const { data: publicUrlData } = supabase.storage
      .from("audios")
      .getPublicUrl(fileName);

    res.json({ url: publicUrlData.publicUrl });
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🎵 Backend audio lancé sur le port ${PORT}`));
