const express = require('express');
const router = express.Router();
const toolsController = require('../controllers/tools.controller');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../temp/uploads');
        fs.ensureDirSync(uploadDir);
        console.log('Upload directory:', uploadDir);
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = uniqueSuffix + path.extname(file.originalname);
        console.log('Generated filename:', filename);
        cb(null, filename);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
    fileFilter: (req, file, cb) => {
        console.log('File filter - mimetype:', file.mimetype);
        console.log('File filter - originalname:', file.originalname);
        cb(null, true);
    }
});

// Audio extraction endpoint
router.post('/extract-audio', (req, res, next) => {
    console.log('POST /extract-audio route hit');
    next();
}, upload.single('file'), (req, res, next) => {
    console.log('Multer middleware completed');
    console.log('File uploaded:', req.file);
    next();
}, toolsController.extractAudio);

// Format conversion endpoint
router.post('/convert', (req, res, next) => {
    console.log('POST /convert route hit');
    next();
}, upload.single('file'), (req, res, next) => {
    console.log('Multer middleware completed');
    console.log('File uploaded:', req.file);
    next();
}, toolsController.convertFormat);

// Status check endpoint
router.get('/status/:downloadId', toolsController.getStatus);

module.exports = router;