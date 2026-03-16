const express = require('express');
const router = express.Router();
const tiktokController = require('../controllers/tiktok.controller');

router.post('/info', tiktokController.getInfo);
router.post('/download', tiktokController.download);
router.post('/no-watermark', tiktokController.downloadNoWatermark);

module.exports = router;