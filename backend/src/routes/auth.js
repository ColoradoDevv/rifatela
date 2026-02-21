const router = require('express').Router();
const controller = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.post('/login', controller.login);
router.post('/logout', requireAuth, controller.logout);
router.get('/me', requireAuth, controller.me);
router.post('/users/sellers', requireAuth, requireRole('admin'), controller.createSeller);
router.get('/users/sellers', requireAuth, requireRole('admin'), controller.listSellers);

module.exports = router;
