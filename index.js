const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

ffmpeg.setFfmpegPath(ffmpegPath);

const upload = multer({ dest: 'uploads/' });
const app = express();

// Middleware nécessaires
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS pour autoriser ton frontend
app.use(cors({
  origin: 'https://camixe.click'
}));

// Configuration de Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ✅ Route d'accueil pour tester si le serveur répond
app.get('/', (req, res) => {
  res.send('🩷 API VoixDuCoeur backend est en ligne 🩷');
});

// ✅ Route de traitement de l'upload audio
app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  console.log('Fichier reçu ?', !!req.file, req.file);

  if (!req.file) {
    return res.status(400).json({ error: "Aucun fichier reçu." });
  }

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

        fs.unlinkSync(webmPath);
        fs.unlinkSync(mp3Path);

        if (error) {
          return res.status(500).json({ error: error.message });
        }

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

// ✅ Route 404 pour toutes les autres URLs
app.use((req, res) => {
  res.status(404).json({ error: "Route non trouvée" });
});

// ✅ Lancement du serveur sur le bon port (Render impose process.env.PORT)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🎵 Serveur audio lancé sur le port ${PORT}`);
});
