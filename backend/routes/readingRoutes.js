const express = require('express');
const router = express.Router();
const { getReadings, createReading } = require('../controllers/readingController');
const { requireAdmin } = require('../middleware/auth');

router.get('/', getReadings);
router.post('/', requireAdmin, createReading);

module.exports = router;
