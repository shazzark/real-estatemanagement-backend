const express = require('express');
const agentController = require('../controllers/agentController');
const authController = require('../controllers/authController');

const router = express.Router();

// ======================
// PUBLIC ROUTES
// ======================

// GET all agents
router.get('/', agentController.getAllAgents);

// GET single agent
router.get('/:id', agentController.getAgent);

// GET agent's properties
router.get('/:id/properties', agentController.getAgentProperties);

// SEARCH agents
router.get('/search/all', agentController.searchAgents);

// GET top agents
router.get('/top/agents', agentController.getTopAgents);

// ======================
// PROTECTED ROUTES
// ======================

// UPDATE agent profile (agent updates own, admin updates any)
router.patch(
  '/:id',
  authController.protect,
  authController.restrictTo('agent', 'admin'),
  agentController.updateAgent,
);

// ======================
// ADMIN ONLY ROUTES
// ======================

// VERIFY agent
router.patch(
  '/:id/verify',
  authController.protect,
  authController.restrictTo('admin'),
  agentController.verifyAgent,
);

// DEACTIVATE agent
router.patch(
  '/:id/deactivate',
  authController.protect,
  authController.restrictTo('admin'),
  agentController.deactivateAgent,
);

module.exports = router;
