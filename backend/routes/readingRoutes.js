const express = require('express');
const router = express.Router();
const { getReadings, createReading } = require('../controllers/readingController');

router.get('/', getReadings);
router.post('/', createReading);

module.exports = router;
