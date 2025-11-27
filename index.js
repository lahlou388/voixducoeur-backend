// index.js
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
  origin: 'https://camixe.click' // modifie si besoin
}));

// Multer -> en mémoire pour éviter les fichiers temporaires
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 } // 40 Mo max (ajuste si nécessaire)
});

// Supabase client (assure-toi d'avoir SUPABASE_URL et SUPABASE_KEY dans tes env)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Health check
app.get('/', (req, res) => {
  res.send('🩷 VoixDuCoeur backend (streaming) fonctionne !');
});

// Upload streaming: receive buffer -> ffmpeg(stream) -> pipe(mp3) -> upload stream to Supabase
app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  console.log("📥 Upload reçu !");
  if (!req.file) {
    console.log("❌ Aucun fichier reçu");
    return res.status(400).json({ error: "Aucun fichier reçu." });
  }

  console.log("📏 Taille du fichier reçu :", req.file.size, "octets");
  console.log("📄 Type du fichier :", req.file.mimetype);

  try {
    // Input stream from buffer
    const inputStream = new stream.PassThrough();
    inputStream.end(req.file.buffer);

    // Output stream for mp3
    const outputStream = new stream.PassThrough();

    // Start ffmpeg conversion pipeline
    console.log("🎧 Conversion FFmpeg démarrée…");
    let ff = ffmpeg(inputStream)
      .setFfmpegPath(ffmpegPath)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .format('mp3')
      .on('start', (cmd) => console.log("🛠 FFmpeg CMD:", cmd))
      .on('error', (err) => {
        console.error("❌ FFmpeg ERROR:", err.message || err);
        // If ffmpeg fails, ensure outputStream is closed to avoid hanging upload
        try { outputStream.destroy(err); } catch (e) {}
      })
      .on('end', () => console.log("✅ Conversion MP3 terminée"))
      .pipe(outputStream, { end: true });

    // Build file name
    const fileName = `${Date.now()}.mp3`;

    console.log("📤 Upload vers Supabase…");

    // Important: For node Readable stream upload Support, pass the stream directly.
    const { data, error } = await supabase.storage
      .from('audios')
      .upload(fileName, outputStream, {
        contentType: 'audio/mp3',
        cacheControl: '3600',
        upsert: true,
        duplex: 'half' // required for Node stream upload in some supabase clients
      });

    if (error) {
      console.error("❌ Erreur upload Supabase:", error);
      return res.status(500).json({ error: error.message || "Erreur upload Supabase" });
    }

    const { data: urlData } = supabase.storage
      .from('audios')
      .getPublicUrl(fileName);

    console.log("🎉 Upload complet → URL :", urlData.publicUrl);

    // Reply with public url
    return res.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("🔥 ERREUR SERVEUR:", err);
    return res.status(500).json({ error: (err && err.message) || "Erreur serveur" });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Route non trouvée" });
});

// Launch server (Render uses process.env.PORT)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🎵 Serveur audio streaming sur port ${PORT}`);
});
// index.js
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
  origin: 'https://camixe.click' // modifie si besoin
}));

// Multer -> en mémoire pour éviter les fichiers temporaires
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 } // 40 Mo max (ajuste si nécessaire)
});

// Supabase client (assure-toi d'avoir SUPABASE_URL et SUPABASE_KEY dans tes env)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Health check
app.get('/', (req, res) => {
  res.send('🩷 VoixDuCoeur backend (streaming) fonctionne !');
});

// Upload streaming: receive buffer -> ffmpeg(stream) -> pipe(mp3) -> upload stream to Supabase
app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  console.log("📥 Upload reçu !");
  if (!req.file) {
    console.log("❌ Aucun fichier reçu");
    return res.status(400).json({ error: "Aucun fichier reçu." });
  }

  console.log("📏 Taille du fichier reçu :", req.file.size, "octets");
  console.log("📄 Type du fichier :", req.file.mimetype);

  try {
    // Input stream from buffer
    const inputStream = new stream.PassThrough();
    inputStream.end(req.file.buffer);

    // Output stream for mp3
    const outputStream = new stream.PassThrough();

    // Start ffmpeg conversion pipeline
    console.log("🎧 Conversion FFmpeg démarrée…");
    let ff = ffmpeg(inputStream)
      .setFfmpegPath(ffmpegPath)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .format('mp3')
      .on('start', (cmd) => console.log("🛠 FFmpeg CMD:", cmd))
      .on('error', (err) => {
        console.error("❌ FFmpeg ERROR:", err.message || err);
        // If ffmpeg fails, ensure outputStream is closed to avoid hanging upload
        try { outputStream.destroy(err); } catch (e) {}
      })
      .on('end', () => console.log("✅ Conversion MP3 terminée"))
      .pipe(outputStream, { end: true });

    // Build file name
    const fileName = `${Date.now()}.mp3`;

    console.log("📤 Upload vers Supabase…");

    // Important: For node Readable stream upload Support, pass the stream directly.
    const { data, error } = await supabase.storage
      .from('audios')
      .upload(fileName, outputStream, {
        contentType: 'audio/mp3',
        cacheControl: '3600',
        upsert: true,
        duplex: 'half' // required for Node stream upload in some supabase clients
      });

    if (error) {
      console.error("❌ Erreur upload Supabase:", error);
      return res.status(500).json({ error: error.message || "Erreur upload Supabase" });
    }

    const { data: urlData } = supabase.storage
      .from('audios')
      .getPublicUrl(fileName);

    console.log("🎉 Upload complet → URL :", urlData.publicUrl);

    // Reply with public url
    return res.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("🔥 ERREUR SERVEUR:", err);
    return res.status(500).json({ error: (err && err.message) || "Erreur serveur" });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Route non trouvée" });
});

// Launch server (Render uses process.env.PORT)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🎵 Serveur audio streaming sur port ${PORT}`);
});
