const express = require('express');
const router = express.Router();
const instagramController = require('../controllers/instagram.controller');
const validation = require('../middleware/validation');

router.post('/info', 
  validation.validateUrl,
  instagramController.getInfo
);

router.post('/download', 
  validation.validateDownload,
  instagramController.download
);

router.post('/story', 
  validation.validateUrl,
  instagramController.downloadStory
);

router.post('/reel', 
  validation.validateUrl,
  instagramController.downloadReel
);

module.exports = router;