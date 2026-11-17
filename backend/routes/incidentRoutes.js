const express = require('express');
const router = express.Router();
const {
    getAllIncidents,
    getIncidentById,
    createIncident,
    updateIncident,
} = require('../controllers/incidentController');
const { requireAdmin } = require('../middleware/auth');

router.get('/', getAllIncidents);
router.get('/:id', getIncidentById);
router.post('/', requireAdmin, createIncident);
router.patch('/:id', requireAdmin, updateIncident);

module.exports = router;
