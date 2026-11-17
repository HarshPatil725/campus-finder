const express = require('express');
const router = express.Router();
const {
    getAllAccessPoints,
    getAccessPointById,
    updateAccessPoint,
} = require('../controllers/accessPointController');
const { requireAdmin } = require('../middleware/auth');

router.get('/', getAllAccessPoints);
router.get('/:id', getAccessPointById);
router.patch('/:id', requireAdmin, updateAccessPoint);

module.exports = router;
