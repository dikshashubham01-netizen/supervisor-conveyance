import express from 'express';
import { upload } from '../middleware/upload.js';
import { authenticateToken } from '../middleware/auth.js';
import { performServerOcr } from '../services/ocrService.js';

const router = express.Router();

router.post('/scan', authenticateToken, upload.single('odometer'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Odometer image file required' });
    }

    const result = await performServerOcr(req.file.path);
    res.json(result);
  } catch (err) {
    console.error('OCR route error:', err);
    res.status(500).json({ error: 'OCR processing failed: ' + err.message });
  }
});

export default router;
