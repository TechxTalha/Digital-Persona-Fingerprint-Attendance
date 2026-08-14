const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const { protectAdmin } = require('../middleware/auth');


const sharp = require('sharp');

/**
 * @route   POST /api/biometrics/verify-png
 * @desc    Verify incoming PNG fingerprint image (POC)
 * @access  Public
 */
router.post('/verify-png', async (req, res) => {
  const { samples } = req.body;
  if (!samples || samples.length === 0) {
    return res.status(400).json({ success: false, message: 'No fingerprint sample provided.' });
  }

  try {
    let incomingSample = samples[0];
    let rawData = incomingSample;
    if (typeof incomingSample === 'object') {
      rawData = incomingSample.Data;
    } else if (typeof incomingSample === 'string' && incomingSample.startsWith('{')) {
       try { rawData = JSON.parse(incomingSample).Data; } catch(e) {}
    }

    if (typeof rawData !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid payload format' });
    }

    let base64 = rawData.replace(/-/g, '+').replace(/_/g, '/');
    if (base64.includes(',')) base64 = base64.split(',')[1];
    
    const buf = Buffer.from(base64, 'base64');

    // Use sharp to read image metadata
    const metadata = await sharp(buf).metadata();

    if (metadata.format !== 'png') {
       return res.status(400).json({ success: false, message: 'Image is not a valid PNG' });
    }

    return res.json({
      success: true,
      message: 'PNG verified successfully',
      details: { 
        mimeType: 'image/png',
        byteLength: buf.length,
        width: metadata.width, 
        height: metadata.height, 
        colorSpace: metadata.space || 'Not provided',
        channels: metadata.channels || 'Not provided',
        depth: metadata.depth ? `${metadata.depth}-bit` : 'Not provided',
        dpi: metadata.density || 'Not provided'
      }
    });

  } catch (error) {
    console.error('Verify PNG error:', error);
    res.status(500).json({ success: false, message: 'Error verifying PNG with Sharp' });
  }
});

/**
 * @route   POST /api/biometrics/poc-compare
 * @desc    Test SourceAFIS microservice matching (A->B, A->C, B->C)
 * @access  Public
 */
router.post('/poc-compare', async (req, res) => {
  const { pngA, pngB, pngC } = req.body;
  if (!pngA || !pngB || !pngC) {
    return res.status(400).json({ success: false, message: 'Requires pngA, pngB, and pngC payloads.' });
  }

  // Helper to extract base64 from WebSDK payload
  const getB64 = (incoming) => {
    let raw = incoming;
    if (typeof incoming === 'object') raw = incoming.Data;
    else if (typeof incoming === 'string' && incoming.startsWith('{')) {
      try { raw = JSON.parse(incoming).Data; } catch(e) {}
    }
    let b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    if (b64.includes(',')) b64 = b64.split(',')[1];
    return b64;
  };

  try {
    const b64A = getB64(pngA);
    const b64B = getB64(pngB);
    const b64C = getB64(pngC);

    const JAVA_MATCHER_URL = process.env.JAVA_MATCHER_URL || 'http://localhost:8080/match';
    
    const startTime = Date.now();

    // 1. Create SourceAFIS template for A (Candidate)
    const tplResA = await fetch(`${JAVA_MATCHER_URL}/template/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ png: b64A })
    });
    const tplDataA = await tplResA.json();
    if (!tplDataA.success) throw new Error('Failed to create template A: ' + tplDataA.message);
    const candidateTemplateA = tplDataA.template;

    // 2. Create SourceAFIS template for B (Candidate for B->C)
    const tplResB = await fetch(`${JAVA_MATCHER_URL}/template/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ png: b64B })
    });
    const tplDataB = await tplResB.json();
    if (!tplDataB.success) throw new Error('Failed to create template B: ' + tplDataB.message);
    const candidateTemplateB = tplDataB.template;

    // 3. Match A (Template) against B (Probe PNG)
    const matchResAB = await fetch(`${JAVA_MATCHER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ probePng: b64B, candidateTemplate: candidateTemplateA })
    });
    const matchDataAB = await matchResAB.json();

    // 4. Match A (Template) against C (Probe PNG)
    const matchResAC = await fetch(`${JAVA_MATCHER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ probePng: b64C, candidateTemplate: candidateTemplateA })
    });
    const matchDataAC = await matchResAC.json();

    // 5. Match B (Template) against C (Probe PNG)
    const matchResBC = await fetch(`${JAVA_MATCHER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ probePng: b64C, candidateTemplate: candidateTemplateB })
    });
    const matchDataBC = await matchResBC.json();
    
    const totalTimeMs = Date.now() - startTime;

    return res.json({
      success: true,
      metrics: {
        templateSizeA: candidateTemplateA.length,
        templateSizeB: candidateTemplateB.length,
        javaProcessingTimeA_Ms: tplDataA.processingTimeMs,
        javaProcessingTimeB_Ms: tplDataB.processingTimeMs,
        javaMatchingTimeAB_Ms: matchDataAB.processingTimeMs,
        javaMatchingTimeAC_Ms: matchDataAC.processingTimeMs,
        javaMatchingTimeBC_Ms: matchDataBC.processingTimeMs,
        nodeTotalTimeMs: totalTimeMs
      },
      scores: {
        AvsB: matchDataAB.score,
        AvsC: matchDataAC.score,
        BvsC: matchDataBC.score
      }
    });

  } catch (error) {
    console.error('POC compare error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error executing POC matching flow' });
  }
});

/**
 * @route   POST /api/biometrics/analyze-quality
 * @desc    Extract pixel intensity stats from PNG (POC Debugging)
 * @access  Public
 */
router.post('/analyze-quality', async (req, res) => {
  const { png } = req.body;
  if (!png) return res.status(400).json({ success: false, message: 'Requires png payload.' });

  try {
    let b64 = png;
    if (typeof png === 'object') b64 = png.Data;
    else if (typeof png === 'string' && png.startsWith('{')) {
      try { b64 = JSON.parse(png).Data; } catch(e) {}
    }
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    if (b64.includes(',')) b64 = b64.split(',')[1];
    
    const buf = Buffer.from(b64, 'base64');
    const image = sharp(buf);
    const metadata = await image.metadata();
    const stats = await image.stats();
    
    // Calculate near-black and near-white manually
    const rawPixels = await image.raw().toBuffer();
    let nearBlackCount = 0;
    let nearWhiteCount = 0;
    const totalPixels = metadata.width * metadata.height;
    // Assuming grayscale or reading just the first channel to estimate
    const channels = metadata.channels || 1;
    
    for (let i = 0; i < rawPixels.length; i += channels) {
      const val = rawPixels[i]; // check red/gray channel
      if (val < 15) nearBlackCount++;
      if (val > 240) nearWhiteCount++;
    }

    const channelStat = stats.channels[0]; // Get primary channel stats
    
    return res.json({
      success: true,
      quality: {
        dimensions: `${metadata.width}x${metadata.height}`,
        byteSize: buf.length,
        format: metadata.space,
        mean: channelStat.mean.toFixed(2),
        min: channelStat.min,
        max: channelStat.max,
        stdDev: channelStat.stdev.toFixed(2),
        nearBlackPct: ((nearBlackCount / totalPixels) * 100).toFixed(2) + '%',
        nearWhitePct: ((nearWhiteCount / totalPixels) * 100).toFixed(2) + '%'
      }
    });
  } catch (error) {
    console.error('Analyze Quality Error:', error);
    res.status(500).json({ success: false, message: 'Failed to analyze image' });
  }
});

module.exports = router;
