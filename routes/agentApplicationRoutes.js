const express = require('express');
const authController = require('../controllers/authController');
const agentApplicationController = require('../controllers/agentApplicationController');

const router = express.Router();

// user applies to become agent
router.post(
  '/apply',
  authController.protect,
  agentApplicationController.applyForAgent,
);

// admin approves agent
router.patch(
  '/:id/approve',
  authController.protect,
  authController.restrictTo('admin'),
  agentApplicationController.approveAgent,
);

// admin rejects agent
router.patch(
  '/:id/reject',
  authController.protect,
  authController.restrictTo('admin'),
  agentApplicationController.rejectAgent,
);

// admin view pending applications
router.get(
  '/pending',
  authController.protect,
  authController.restrictTo('admin'),
  agentApplicationController.getPendingAgents,
);

module.exports = router;
