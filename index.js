// index.js
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
app.use(cors({ origin: "*" }));
const upload = multer({ dest: "uploads/" });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// POST /upload-audio
app.post("/upload-audio", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });

  try {
    const fileName = `${Date.now()}_${req.file.originalname}`;
    const fileStream = fs.createReadStream(req.file.path);

    // Upload vers Supabase Storage avec l'option duplex (Node 18/20)
    const { data, error } = await supabase.storage
      .from("audios")
      .upload(fileName, fileStream, {
        contentType: req.file.mimetype,
        upsert: true,
        duplex: "half", // 🔑 obligatoire
      });

    // Supprimer fichier temporaire
    fs.unlinkSync(req.file.path);

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
