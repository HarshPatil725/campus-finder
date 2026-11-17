const express = require('express');
const router = express.Router();
const {
    getAllAccessPoints,
    getAccessPointById,
} = require('../controllers/accessPointController');

router.get('/', getAllAccessPoints);
router.get('/:id', getAccessPointById);

module.exports = router;
