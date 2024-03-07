const express = require('express');
const router = express.Router();
const auth = require('../helpers/authentification');

const userController = require('../controllers/leader/user');
const roleController = require('../controllers/leader/role');
const operationTypeController = require('../controllers/leader/operationType');

router.get('/users', auth.isAuthenticated, auth.isLeader(), userController.index);
router.get('/users/:id', auth.isAuthenticated, auth.isLeader(), userController.show);
router.post('/users/:id', auth.isAuthenticated, auth.isLeader(), userController.update);
router.get('/users/:id/delete', auth.isAuthenticated, auth.isLeader(), userController.delete);

router.get('/roles', auth.isAuthenticated, auth.isLeader(), roleController.index);
router.get('/roles/create', auth.isAuthenticated, auth.isLeader(), roleController.create);
router.post('/roles/create', auth.isAuthenticated, auth.isLeader(), roleController.store);
router.get('/roles/:id', auth.isAuthenticated, auth.isLeader(), roleController.show);
router.post('/roles/:id', auth.isAuthenticated, auth.isLeader(), roleController.update);
router.get('/roles/:id/delete', auth.isAuthenticated, auth.isLeader(), roleController.delete);

router.get('/operationTypes', auth.isAuthenticated, auth.isLeader(), operationTypeController.index);
router.get('/operationTypes/create', auth.isAuthenticated, auth.isLeader(), operationTypeController.create);
router.post('/operationTypes/create', auth.isAuthenticated, auth.isLeader(), operationTypeController.store);
router.get('/operationTypes/:id', auth.isAuthenticated, auth.isLeader(), operationTypeController.show);
router.post('/operationTypes/:id', auth.isAuthenticated, auth.isLeader(), operationTypeController.update);
router.get('/operationTypes/:id/delete', auth.isAuthenticated, auth.isLeader(), operationTypeController.delete);

module.exports = router;
