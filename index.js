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
app.use(cors({ origin: 'https://camixe.click' }));

// Multer en mémoire pour éviter d'écrire sur disque
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20 Mo max
});

// Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.get('/', (req, res) => {
  res.send('🩷 API VoixDuCoeur backend en ligne 🩷');
});

app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu." });

  try {
    // Crée un Readable stream depuis le buffer Multer
    const readableStream = new stream.PassThrough();
    readableStream.end(req.file.buffer);

    // Création d'un buffer pour stocker le mp3
    const chunks = [];
    const ffmpegProcess = ffmpeg(readableStream)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .format('mp3')
      .on('error', (err) => {
        console.error('FFmpeg error:', err.message);
        return res.status(500).json({ error: err.message });
      })
      .on('end', async () => {
        // Fusionne tous les chunks
        const mp3Buffer = Buffer.concat(chunks);
        const fileName = `${Date.now()}.mp3`;

        // Upload vers Supabase
        const { data, error } = await supabase.storage
          .from('audios')
          .upload(fileName, mp3Buffer, {
            contentType: 'audio/mp3',
            upsert: true
          });

        if (error) return res.status(500).json({ error: error.message });

        const { data: publicUrlData } = supabase.storage
          .from('audios')
          .getPublicUrl(fileName);

        res.json({ url: publicUrlData.publicUrl });
      })
      .pipe();

    ffmpegProcess.on('data', (chunk) => chunks.push(chunk));
  } catch (err) {
    console.error('Erreur serveur:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🎵 Serveur audio lancé sur le port ${PORT}`));
