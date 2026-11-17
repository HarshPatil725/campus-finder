const express = require('express');
const router = express.Router();
const {
    getAllIncidents,
    getIncidentById,
    createIncident,
    updateIncident,
} = require('../controllers/incidentController');

router.get('/', getAllIncidents);
router.get('/:id', getIncidentById);
router.post('/', createIncident);
router.patch('/:id', updateIncident);

module.exports = router;
