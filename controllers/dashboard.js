const db = require('../models').sequelize;
const moment = require('moment');
moment.locale('de');
const { Op, Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../models');

exports.index = async (req, res) => {
   res.render('tracker/index', {
      title: 'Dashboard',
   });
};

exports.stats = async (req, res) => {
   const allTimeOperations = await db.models.Operation.findAndCountAll();
   const userAllTimeOperations = await db.models.Operation.findAndCountAll({
      include: [
         {
            model: sequelize.models.User,
            where: {
               id: req.user.id,
            },
         },
         'OperationType',
      ],
   });
   // console.log(userAllTimeOperations);
   // const allOperationTypes = await db.models.Operation.findAndCountAll({
   //     include: [{
   //             model: sequelize.models.OperationType
   //         },
   //         {
   //             model: sequelize.models.User,
   //             where: {
   //                 id: req.user.id,
   //             }
   //         }
   //     ],
   //     group: 'OperationType'
   // });
   // var operations = await db.models.Operation.findAll({
   //     include: [
   //         "OperationType",
   //         {
   //             association: "Users"
   //         }
   //     ]
   // });
   // operations.forEach(op => {
   //     if (op.valid) {
   //         const points = op.OperationType.points;
   //         var found = op.Users.find(u => u.id == req.user.id);
   //         if (!found) {
   //             operations = operations.filter(function(item) {
   //                 return item !== op;
   //             });
   //         }
   //     }
   // });
   // console.log(operations)
   // const operationTypes = operations.map(o => o.OperationType).filter(function(ele, pos) {
   //     return operations.map(o => o.OperationType).indexOf(ele) == pos;
   // })
   // console.log(operationTypes)

   res.render('tracker/stats', {
      allTimeOperations: allTimeOperations.count,
      userAllTimeOperationsCount: userAllTimeOperations.count,
      // userAllTimeOperations: userAllTimeOperations.rows,
      // allOperationTypes: allOperationTypes,
      title: 'Statistiken',
   });
};

exports.profile = async (req, res) => {
   res.render('tracker/profile', {
      title: 'Profil',
   });
};

exports.map = async (req, res) => {
   res.render('tracker/map', {
      title: 'Map',
   });
};
