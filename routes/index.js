const express = require('express');
const router = express.Router();
const auth = require('../helpers/authentification');

const loginController = require('../controllers/login');
const dashboardController = require('../controllers/dashboard');
const operationController = require('../controllers/operations');

/* GET home page. */
router.get('/', dashboardController.index);

/* Login System. */
router.get('/login', auth.isUnauthenticated, loginController.login);
router.get('/login/callback', auth.isUnauthenticated, loginController.loginSubmit);
router.get('/logout', auth.isAuthenticated, loginController.logout);

/* Operations System */
router.get('/operations', auth.isAuthenticated, operationController.index);
router.post('/operations', auth.isAuthenticated, operationController.setMembership);

router.get('/payment', auth.isAuthenticated, operationController.payment);
router.post('/payment', auth.isAuthenticated, operationController.setTempMoney);

router.get('/operations/create', auth.isAuthenticated, operationController.create);
router.post('/operations/create', auth.isAuthenticated, operationController.store);

router.get('/operations/manage', auth.isAuthenticated, auth.hasRank(3), operationController.managementIndex);
router.get('/operations/manage/:id/validate', auth.isAuthenticated, auth.hasRank(3), operationController.managementValidate);
router.get('/operations/manage/:id/delete', auth.isAuthenticated, auth.hasRank(3), operationController.managementDelete);
router.post('/operations/manage/:id/addUser', auth.isAuthenticated, operationController.managementAddUser);
router.post('/operations/manage/:id/removeUser', auth.isAuthenticated, operationController.managementRemoveUser);

router.get('/operations/stats', auth.isAuthenticated, operationController.statisticsIndex);

router.get('/gwStorage', auth.isAuthenticated, dashboardController.calcGWStorage);

/* Profile & Settings System */
router.get('/profile', auth.isAuthenticated, dashboardController.profile);
router.get('/stats', auth.isAuthenticated, dashboardController.stats);

module.exports = router;
