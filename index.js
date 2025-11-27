const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const stream = require('stream');
require('dotenv').config();

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'https://camixe.click'
}));

// Multer -> en mémoire pour éviter les fichiers temporaires
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 } // 30 Mo max 
});

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Test route
app.get('/', (req, res) => {
  res.send('🩷 VoixDuCoeur backend (streaming) fonctionne !');
});

// ----- UPLOAD AUDIO (iPhone + Android) -----
app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  console.log("📥 Upload reçu !");
  
  if (!req.file) {
    console.log("❌ Aucun fichier reçu");
    return res.status(400).json({ error: "Aucun fichier reçu." });
  }

  console.log("📏 Taille du fichier reçu :", req.file.size, "octets");
  console.log("📄 Type du fichier :", req.file.mimetype);

  try {
    // Create a stream from the uploaded file
    const inputStream = new stream.PassThrough();
    inputStream.end(req.file.buffer);

    // Output stream for MP3
    const outputStream = new stream.PassThrough();

    // FFmpeg conversion pipeline
    console.log("🎧 Conversion FFmpeg démarrée…");

    ffmpeg(inputStream)
      .setFfmpegPath(ffmpegPath)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .format('mp3')
      .on('start', (cmd) => console.log("🛠 FFmpeg CMD:", cmd))
      .on('error', (err) => {
        console.error("❌ FFmpeg ERROR:", err.message);
        return res.status(500).json({ error: "Erreur conversion audio" });
      })
      .on('end', () => console.log("✅ Conversion MP3 terminée"))
      .pipe(outputStream);

    const fileName = `${Date.now()}.mp3`;

    console.log("📤 Upload vers Supabase…");

    const { data, error } = await supabase.storage
      .from('audios')
      .upload(fileName, outputStream, {
        contentType: 'audio/mp3',
        cacheControl: '3600',
        upsert: true,
        duplex: 'half'
      });

    if (error) {
      console.error("❌ Erreur upload Supabase:", error);
      return res.status(500).json({ error: error.message });
    }

    const { data: urlData } = supabase.storage
      .from('audios')
      .getPublicUrl(fileName);

    console.log("🎉 Upload complet → URL :", urlData.publicUrl);

    return res.json({ url: urlData.publicUrl });

  } catch (err) {
    console.error("🔥 ERREUR SERVEUR:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Route non trouvée" });
});

// Launch server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🎵 Serveur audio streaming sur port ${PORT}`);
});
