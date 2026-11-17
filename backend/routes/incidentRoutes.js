const express = require('express');
const router = express.Router();
const {
    getAllIncidents,
    getIncidentById,
} = require('../controllers/incidentController');

router.get('/', getAllIncidents);
router.get('/:id', getIncidentById);

module.exports = router;
