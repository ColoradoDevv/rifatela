const router = require('express').Router();
const controller = require('../controllers/rafflesController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Boleta tracking (must be before /:id to avoid conflict)
router.get('/ticket/:code', controller.trackTicket);
router.get('/boleta/:code', controller.trackTicket);
router.get('/admin/stats', requireAuth, requireRole('admin'), controller.adminStats);

// Saved boletas (userSecret en header X-User-Secret o body; sin userId en URL)
router.post('/tickets/save', controller.saveTicket);
router.get('/tickets/my', controller.getMyTickets);
router.delete('/tickets/:code', controller.removeSavedTicket);
router.post('/boletas/save', controller.saveTicket);
router.get('/boletas/my', controller.getMyTickets);
router.delete('/boletas/:code', controller.removeSavedTicket);

// CRUD
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', requireAuth, requireRole('admin'), controller.create);

// Actions
router.post('/:id/buy', controller.buyTicket);
router.post('/:id/register-sale', requireAuth, requireRole('admin', 'seller'), controller.registerSale);
router.post('/:id/draw', requireAuth, requireRole('admin'), controller.drawWinner);

module.exports = router;
