const express = require('express');
const router = express.Router();
const youtubeController = require('../controllers/youtube.controller');

router.post('/search', youtubeController.search);
router.post('/info', youtubeController.getInfo);
router.post('/download', youtubeController.download);
router.get('/formats/:videoId', youtubeController.getFormats);

module.exports = router;