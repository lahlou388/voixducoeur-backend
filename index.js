// index.js
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
const upload = multer({ dest: 'uploads/' });

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: 'https://camixe.click' }));

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Route d'accueil
app.get('/', (req, res) => {
  res.send('🩷 API VoixDuCoeur backend est en ligne 🩷');
});

// Route upload audio
app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  console.log('Fichier reçu ?', !!req.file, req.file);

  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu." });

  const webmPath = req.file.path;
  const mp3Path = webmPath + '.mp3';

  // Conversion WebM → MP3
  ffmpeg(webmPath)
    .toFormat('mp3')
    .on('end', async () => {
      try {
        const mp3Buffer = fs.readFileSync(mp3Path);
        const fileName = `${Date.now()}.mp3`;

        // 🔑 Important pour Node 18+ : duplex: 'half'
        const { data, error } = await supabase.storage
          .from('audios')
          .upload(fileName, mp3Buffer, {
            contentType: 'audio/mp3',
            upsert: true,
            duplex: 'half'
          });

        // Nettoyage fichiers temporaires
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

// Route 404
app.use((req, res) => {
  res.status(404).json({ error: "Route non trouvée" });
});

// Lancement serveur
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🎵 Serveur audio lancé sur le port ${PORT}`);
});
