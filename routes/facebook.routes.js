const express = require('express');
const router = express.Router();
const facebookController = require('../controllers/facebook.controller');

// Get video information
router.post('/info', facebookController.getInfo);

// Download video (with options)
router.post('/download', facebookController.download);

// Download video only (no audio)
router.post('/video', facebookController.downloadVideo);

// Download live video
router.post('/live', facebookController.downloadLive);

// Get available formats
router.get('/formats/:videoId', facebookController.getFormats);

// Download management
router.get('/status/:downloadId', facebookController.getDownloadStatus);
router.delete('/cancel/:downloadId', facebookController.cancelDownload);

module.exports = router;