const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware pour autoriser ton frontend et gérer les grosses requêtes
app.use(cors({
  origin: 'https://camixe.click',  // ton frontend
  methods: ['GET','POST','PUT','DELETE'],
  credentials: true
}));

// Augmente la limite des requêtes pour des fichiers volumineux (~50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Multer avec limite de taille (1 minute d'audio ≈ 10MB selon codec)
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max
});

// Configuration Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Route test
app.get('/', (req, res) => {
  res.send('🩷 API VoixDuCoeur backend est en ligne 🩷');
});

// Route upload audio
app.post('/upload-audio', (req, res) => {
  upload.single('audio')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu." });

    const webmPath = req.file.path;
    const mp3Path = webmPath + '.mp3';

    ffmpeg(webmPath)
      .toFormat('mp3')
      .on('end', async () => {
        try {
          const mp3Buffer = fs.readFileSync(mp3Path);
          const fileName = `${Date.now()}.mp3`;

          const { data, error } = await supabase.storage
            .from('audios')
            .upload(fileName, mp3Buffer, {
              contentType: 'audio/mp3',
              upsert: true
            });

          // Supprimer fichiers temporaires
          fs.unlinkSync(webmPath);
          fs.unlinkSync(mp3Path);

          if (error) return res.status(500).json({ error: error.message });

          const { data: publicUrlData } = supabase.storage
            .from('audios')
            .getPublicUrl(fileName);

          res.json({ url: publicUrlData.publicUrl });
        } catch (err) {
          if (fs.existsSync(webmPath)) fs.unlinkSync(webmPath);
          if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
          res.status(500).json({ error: err.message });
        }
      })
      .on('error', (err) => {
        if (fs.existsSync(webmPath)) fs.unlinkSync(webmPath);
        res.status(500).json({ error: err.message });
      })
      .save(mp3Path);
  });
});

// Timeout serveur pour fichiers longs (1 minute max)
const server = app.listen(PORT, () => {
  console.log(`🎵 Serveur audio lancé sur le port ${PORT}`);
});
server.setTimeout(2 * 60 * 1000); // 2 minutes pour être safe
