const express = require('express');
const router = express.Router();
const { getReadings } = require('../controllers/readingController');

router.get('/', getReadings);

module.exports = router;
