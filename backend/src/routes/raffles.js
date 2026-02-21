const router = require('express').Router();
const controller = require('../controllers/rafflesController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Boleta tracking (must be before /:id to avoid conflict)
router.get('/ticket/:code', controller.trackTicket);
router.get('/boleta/:code', controller.trackTicket);
router.get('/admin/stats', requireAuth, requireRole('admin'), controller.adminStats);

// Saved boletas endpoints (must be before /:id to avoid conflict)
router.post('/tickets/save', controller.saveTicket);
router.get('/tickets/my/:userId', controller.getMyTickets);
router.delete('/tickets/:code/:userId', controller.removeSavedTicket);
router.post('/boletas/save', controller.saveTicket);
router.get('/boletas/my/:userId', controller.getMyTickets);
router.delete('/boletas/:code/:userId', controller.removeSavedTicket);

// CRUD
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);

// Actions
router.post('/:id/buy', controller.buyTicket);
router.post('/:id/register-sale', requireAuth, requireRole('admin', 'seller'), controller.registerSale);
router.post('/:id/draw', controller.drawWinner);

module.exports = router;
