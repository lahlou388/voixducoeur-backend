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

app.use(express.json());
app.use(cors({ origin: '*' })); // pour test, mettre ton domaine en prod

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.get('/', (req, res) => res.send('🩷 Backend VoixDuCoeur en ligne 🩷'));

app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu." });

  const inputPath = req.file.path;
  const outputName = `${Date.now()}.webm`;
  const outputPath = path.join('uploads', outputName);

  ffmpeg(inputPath)
    .outputOptions(['-c:a libopus', '-b:a 64k', '-vn'])
    .toFormat('webm')
    .on('end', async () => {
      try {
        const { data, error } = await supabase.storage
          .from('audios')
          .upload(outputName, fs.createReadStream(outputPath), {
            contentType: 'audio/webm',
            upsert: true
          });

        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

        if (error) return res.status(500).json({ error: error.message });

        const { data: publicUrlData } = supabase.storage.from('audios').getPublicUrl(outputName);
        res.json({ url: publicUrlData.publicUrl });
      } catch (err) {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        res.status(500).json({ error: err.message });
      }
    })
    .on('error', (err) => {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      res.status(500).json({ error: err.message });
    })
    .save(outputPath);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🎵 Backend audio lancé sur le port ${PORT}`));
