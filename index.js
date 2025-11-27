const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const upload = multer({ dest: 'uploads/' });
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.get('/', (req, res) => res.send('🩷 Backend VoixDuCoeur en ligne 🩷'));

// Upload audio
app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu." });

  const filePath = req.file.path;
  const fileName = `${Date.now()}_${req.file.originalname}`;

  try {
    const { data, error } = await supabase.storage
      .from('audios')
      .upload(fileName, fs.createReadStream(filePath), {
        contentType: req.file.mimetype,
        upsert: true
      });

    // Supprimer fichier local
    fs.unlinkSync(filePath);

    if (error) return res.status(500).json({ error: error.message });

    const { data: publicUrlData } = supabase.storage
      .from('audios')
      .getPublicUrl(fileName);

    return res.json({ url: publicUrlData.publicUrl });
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🎵 Backend audio lancé sur le port ${PORT}`));
