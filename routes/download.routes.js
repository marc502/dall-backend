const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/download.controller');

router.get('/status/:downloadId', downloadController.getStatus);
router.get('/file/:filename', downloadController.getFile);
router.delete('/cancel/:downloadId', downloadController.cancelDownload);

module.exports = router;