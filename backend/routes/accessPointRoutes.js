const express = require('express');
const router = express.Router();
const {
    getAllAccessPoints,
    getAccessPointById,
    updateAccessPoint,
} = require('../controllers/accessPointController');

router.get('/', getAllAccessPoints);
router.get('/:id', getAccessPointById);
router.patch('/:id', updateAccessPoint);

module.exports = router;
