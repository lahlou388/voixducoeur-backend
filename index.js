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
const PORT = process.env.PORT || 4000;

// CORS pour ton frontend
app.use(cors({
  origin: 'https://camixe.click', // change si besoin
  methods: ['GET','POST','PUT','DELETE'],
  credentials: true
}));

// Limites JSON/URL pour gros fichiers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Multer pour upload fichiers audio
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max
});

// Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Route test
app.get('/', (req,res)=>res.send("🩷 Backend VoixDuCoeur OK 🩷"));

// Route upload audio
app.post('/upload-audio', (req,res)=>{
  upload.single('audio')(req,res, async (err)=>{
    if(err) return res.status(400).json({error:err.message});
    if(!req.file) return res.status(400).json({error:"Aucun fichier reçu."});

    const inputPath = req.file.path;
    const outputPath = inputPath + '.mp3'; // Conversion finale MP3

    ffmpeg(inputPath)
      .audioBitrate(64)  // 64 kbps
      .toFormat('mp3')
      .on('end', async ()=>{
        try {
          const buffer = fs.readFileSync(outputPath);
          const fileName = `${Date.now()}.mp3`;

          // Upload Supabase
          const { data, error } = await supabase.storage
            .from('audios')
            .upload(fileName, buffer, { contentType:'audio/mp3', upsert:true });

          // Nettoyage fichiers temporaires
          if(fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if(fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

          if(error) return res.status(500).json({error:error.message});

          const { data: publicUrlData } = supabase.storage
            .from('audios')
            .getPublicUrl(fileName);

          res.json({ url: publicUrlData.publicUrl });
        } catch(e){
          if(fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if(fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          res.status(500).json({error:e.message});
        }
      })
      .on('error', (e)=>{
        if(fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if(fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        res.status(500).json({error:e.message});
      })
      .save(outputPath);
  });
});

// Timeout serveur 2 minutes pour audios longs
const server = app.listen(PORT, ()=>console.log(`🎵 Serveur lancé sur port ${PORT}`));
server.setTimeout(2*60*1000);
