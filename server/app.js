const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const corsConfig = require('../config/cors.config');
const rateLimiter = require('../middleware/rateLimiter');
const errorHandler = require('../middleware/errorHandler');

// Routes
const youtubeRoutes = require('../routes/youtube.routes');
const tiktokRoutes = require('../routes/tiktok.routes');
const instagramRoutes = require('../routes/instagram.routes');
const facebookRoutes = require('../routes/facebook.routes');
const downloadRoutes = require('../routes/download.routes');
const toolsRoutes = require('../routes/tools.routes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors(corsConfig));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Trust proxy (for Render)
app.set('trust proxy', 1);

// Rate limiting
app.use('/api/', rateLimiter);

// Static files for downloads
app.use('/downloads', express.static(path.join(__dirname, '../temp/downloads')));

// Routes
app.use('/api/youtube', youtubeRoutes);
app.use('/api/tiktok', tiktokRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api', toolsRoutes); // mounts at /api/extract-audio and /api/convert

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    platforms: ['youtube', 'tiktok', 'instagram', 'facebook', 'tools']
  });
});

// Error handling
app.use(errorHandler);

module.exports = app;