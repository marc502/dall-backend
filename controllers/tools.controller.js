const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const execPromise = util.promisify(exec);

class ToolsController {
    constructor() {
        // Initialize paths as instance properties
        this.downloadsPath = path.join(__dirname, '../temp/downloads');
        this.uploadsPath = path.join(__dirname, '../temp/uploads');
        
        // Ensure directories exist
        this.ensureDirectories();
        
        console.log('ToolsController initialized with paths:');
        console.log('- Downloads:', this.downloadsPath);
        console.log('- Uploads:', this.uploadsPath);
        
        // Bind methods to ensure 'this' context
        this.extractAudio = this.extractAudio.bind(this);
        this.convertFormat = this.convertFormat.bind(this);
        this.getStatus = this.getStatus.bind(this);
    }

    async ensureDirectories() {
        try {
            await fs.ensureDir(this.downloadsPath);
            await fs.ensureDir(this.uploadsPath);
            console.log('Directories ensured');
        } catch (error) {
            console.error('Error ensuring directories:', error);
        }
    }

    _escapeArg(arg) {
        if (!arg) return '""';
        // Escape double quotes and wrap in quotes
        return `"${arg.replace(/"/g, '\\"')}"`;
    }

    async extractAudio(req, res) {
        try {
            console.log('='.repeat(50));
            console.log('EXTRACT AUDIO REQUEST');
            console.log('='.repeat(50));
            console.log('Request body:', req.body);
            console.log('File:', req.file);
            console.log('Downloads path:', this.downloadsPath);

            if (!req.file) {
                console.error('No file uploaded');
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const { format = 'mp3', quality = '128' } = req.body;
            const inputPath = req.file.path;
            const downloadId = uuidv4();
            const outputDir = path.join(this.downloadsPath, downloadId);
            
            console.log('Input path:', inputPath);
            console.log('Output dir:', outputDir);
            console.log('Format:', format);
            console.log('Quality:', quality);
            
            await fs.ensureDir(outputDir);

            // Generate output filename
            const originalName = req.file.originalname;
            const baseName = path.basename(originalName, path.extname(originalName));
            const outputFilename = `${baseName}.${format}`;
            const outputPath = path.join(outputDir, outputFilename);

            console.log('Output filename:', outputFilename);
            console.log('Output path:', outputPath);

            // Build FFmpeg command based on format
            let ffmpegCommand = `ffmpeg -i ${this._escapeArg(inputPath)} -y`;

            switch (format) {
                case 'mp3':
                    ffmpegCommand += ` -vn -acodec libmp3lame -ab ${quality}k`;
                    break;
                case 'm4a':
                    ffmpegCommand += ` -vn -acodec aac -b:a ${quality}k`;
                    break;
                case 'wav':
                    ffmpegCommand += ` -vn -acodec pcm_s16le`;
                    break;
                case 'flac':
                    ffmpegCommand += ` -vn -acodec flac`;
                    break;
                case 'aac':
                    ffmpegCommand += ` -vn -acodec aac -b:a ${quality}k`;
                    break;
                case 'ogg':
                    ffmpegCommand += ` -vn -acodec libvorbis -q:a ${Math.floor(quality/64)}`;
                    break;
                default:
                    ffmpegCommand += ` -vn -acodec libmp3lame -ab ${quality}k`;
            }

            ffmpegCommand += ` ${this._escapeArg(outputPath)}`;

            console.log('Executing FFmpeg command:', ffmpegCommand);

            // Execute FFmpeg
            const { stdout, stderr } = await execPromise(ffmpegCommand);
            
            if (stderr) {
                console.log('FFmpeg stderr:', stderr);
            }
            if (stdout) {
                console.log('FFmpeg stdout:', stdout);
            }

            // Check if file was created
            const fileExists = await fs.pathExists(outputPath);
            console.log('Output file exists:', fileExists);
            
            if (!fileExists) {
                throw new Error('Audio extraction failed - output file not created');
            }

            // Get file stats
            const stats = await fs.stat(outputPath);
            console.log('Output file size:', stats.size, 'bytes');

            // Send file
            res.download(outputPath, outputFilename, async (err) => {
                if (err) {
                    console.error('Download error:', err);
                } else {
                    console.log('File sent successfully');
                }
                
                // Clean up files after sending (wait 5 minutes before deleting)
                setTimeout(async () => {
                    try {
                        console.log('Cleaning up files...');
                        await fs.remove(inputPath).catch(e => console.error('Error removing input:', e));
                        await fs.remove(outputDir).catch(e => console.error('Error removing output dir:', e));
                        console.log('Cleanup complete');
                    } catch (cleanupErr) {
                        console.error('Cleanup error:', cleanupErr);
                    }
                }, 300000); // 5 minutes
            });

        } catch (error) {
            console.error('Audio extraction error:', error);
            // Clean up input file on error
            if (req.file && req.file.path) {
                await fs.remove(req.file.path).catch(console.error);
            }
            res.status(500).json({ error: error.message || 'Audio extraction failed' });
        }
    }

    async convertFormat(req, res) {
        try {
            console.log('='.repeat(50));
            console.log('CONVERT FORMAT REQUEST');
            console.log('='.repeat(50));
            console.log('Request body:', req.body);
            console.log('File:', req.file);
            console.log('Downloads path:', this.downloadsPath);
            console.log('Uploads path:', this.uploadsPath);

            if (!req.file) {
                console.error('No file uploaded');
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const { fromFormat, toFormat, videoQuality = 'same', audioBitrate = 'same' } = req.body;
            const inputPath = req.file.path;
            const downloadId = uuidv4();
            const outputDir = path.join(this.downloadsPath, downloadId);
            
            console.log('Input path:', inputPath);
            console.log('Output dir:', outputDir);
            console.log('From format:', fromFormat);
            console.log('To format:', toFormat);
            console.log('Video quality:', videoQuality);
            console.log('Audio bitrate:', audioBitrate);
            
            await fs.ensureDir(outputDir);

            // Generate output filename
            const originalName = req.file.originalname;
            const baseName = path.basename(originalName, path.extname(originalName));
            const outputFilename = `${baseName}.${toFormat}`;
            const outputPath = path.join(outputDir, outputFilename);

            console.log('Output filename:', outputFilename);
            console.log('Output path:', outputPath);

            // Build FFmpeg command
            let ffmpegCommand = `ffmpeg -i ${this._escapeArg(inputPath)} -y`;

            // Define format categories
            const videoFormats = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv', 'm4v', '3gp', 'mpg', 'mpeg'];
            const audioFormats = ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg', 'wma', 'aiff'];

            // Check if converting to audio only
            const isAudioOutput = audioFormats.includes(toFormat);
            
            if (isAudioOutput) {
                // Audio output - strip video
                ffmpegCommand += ` -vn`;
                
                // Set audio codec based on format
                switch (toFormat) {
                    case 'mp3':
                        ffmpegCommand += ` -acodec libmp3lame`;
                        break;
                    case 'wav':
                        ffmpegCommand += ` -acodec pcm_s16le`;
                        break;
                    case 'm4a':
                    case 'aac':
                        ffmpegCommand += ` -acodec aac`;
                        break;
                    case 'flac':
                        ffmpegCommand += ` -acodec flac`;
                        break;
                    case 'ogg':
                        ffmpegCommand += ` -acodec libvorbis`;
                        break;
                    case 'wma':
                        ffmpegCommand += ` -acodec wmav2`;
                        break;
                }
                
                // Set audio bitrate
                if (audioBitrate !== 'same') {
                    ffmpegCommand += ` -b:a ${audioBitrate}k`;
                }
            } else {
                // Video output
                // Set video codec
                ffmpegCommand += ` -c:v libx264`;
                
                // Set video quality
                if (videoQuality !== 'same') {
                    ffmpegCommand += ` -vf scale=-2:${videoQuality}`;
                }
                
                // Set audio codec
                ffmpegCommand += ` -c:a aac`;
                
                // Set audio bitrate
                if (audioBitrate !== 'same') {
                    ffmpegCommand += ` -b:a ${audioBitrate}k`;
                }
                
                // Set pixel format for better compatibility
                ffmpegCommand += ` -pix_fmt yuv420p`;
            }

            ffmpegCommand += ` ${this._escapeArg(outputPath)}`;

            console.log('Executing FFmpeg command:', ffmpegCommand);

            // Execute FFmpeg
            const { stdout, stderr } = await execPromise(ffmpegCommand);
            
            if (stderr) {
                console.log('FFmpeg stderr:', stderr);
            }
            if (stdout) {
                console.log('FFmpeg stdout:', stdout);
            }

            // Check if file was created
            const fileExists = await fs.pathExists(outputPath);
            console.log('Output file exists:', fileExists);
            
            if (!fileExists) {
                throw new Error('Format conversion failed - output file not created');
            }

            // Get file stats
            const stats = await fs.stat(outputPath);
            console.log('Output file size:', stats.size, 'bytes');

            // Send file
            res.download(outputPath, outputFilename, async (err) => {
                if (err) {
                    console.error('Download error:', err);
                } else {
                    console.log('File sent successfully');
                }
                
                // Clean up files after sending (wait 5 minutes before deleting)
                setTimeout(async () => {
                    try {
                        console.log('Cleaning up files...');
                        await fs.remove(inputPath).catch(e => console.error('Error removing input:', e));
                        await fs.remove(outputDir).catch(e => console.error('Error removing output dir:', e));
                        console.log('Cleanup complete');
                    } catch (cleanupErr) {
                        console.error('Cleanup error:', cleanupErr);
                    }
                }, 300000); // 5 minutes
            });

        } catch (error) {
            console.error('Format conversion error:', error);
            // Clean up input file on error
            if (req.file && req.file.path) {
                await fs.remove(req.file.path).catch(console.error);
            }
            res.status(500).json({ error: error.message || 'Format conversion failed' });
        }
    }

    async getStatus(req, res) {
        try {
            const { downloadId } = req.params;
            console.log('Status check for downloadId:', downloadId);
            
            const downloadPath = path.join(this.downloadsPath, downloadId);
            
            const exists = await fs.pathExists(downloadPath);
            console.log('Download path exists:', exists);
            
            if (exists) {
                const files = await fs.readdir(downloadPath);
                console.log('Files in directory:', files);
                
                if (files.length > 0) {
                    return res.json({
                        success: true,
                        data: {
                            exists: true,
                            file: files[0]
                        }
                    });
                }
            }
            
            res.json({
                success: true,
                data: {
                    exists: false
                }
            });
        } catch (error) {
            console.error('Status check error:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

// Create and export a single instance
const toolsController = new ToolsController();
module.exports = toolsController;