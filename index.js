// index.js - Backend complet VoixDuCoeur

const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

ffmpeg.setFfmpegPath(ffmpegPath);

const upload = multer({ dest: 'uploads/' });
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*' })); // ⚠️ remplacer '*' par ton front si nécessaire

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Test route
app.get('/', (req, res) => res.send('🩷 Backend VoixDuCoeur en ligne 🩷'));

// Route upload audio
app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu." });

  const inputPath = req.file.path;
  const outputName = `${Date.now()}.webm`;
  const outputPath = path.join('uploads', outputName);

  try {
    // Conversion en .webm
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions(['-c:a libopus', '-b:a 64k', '-vn'])
        .toFormat('webm')
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });

    // Lire le fichier en Buffer (corrige l’erreur duplex Node 20+)
    const fileBuffer = fs.readFileSync(outputPath);

    const { data, error: uploadError } = await supabase.storage
      .from('audios')
      .upload(outputName, fileBuffer, {
        contentType: 'audio/webm',
        upsert: true
      });

    // Supprimer fichiers locaux
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    if (uploadError) return res.status(500).json({ error: uploadError.message });

    const { data: publicUrlData } = supabase.storage
      .from('audios')
      .getPublicUrl(outputName);

    res.json({ url: publicUrlData.publicUrl });

  } catch (err) {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    console.error("Erreur backend:", err);
    res.status(500).json({ error: err.message });
  }
});

// Lancer le serveur
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🎵 Backend audio lancé sur le port ${PORT}`));
