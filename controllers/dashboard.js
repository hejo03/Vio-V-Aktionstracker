const db = require('../models').sequelize;
const moment = require('moment');
moment.locale('de');
const { Op, Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../models');
const { getData } = require('../helpers/vioHandler');



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

exports.calcGWStorage = async (req, res) => {
   const storageData = await getData(req.user.id, '/group/storage');
   const serverItems = await getData(req.user.id, '/system/items');
   const gwData = await getData(req.user.id, '/group/areas');
   console.log(storageData);
   console.log(serverItems);
   if (!serverItems) {
      console.log("Fehler: Serveritems nicht gefunden.");
      return;
   }
   if (!storageData || storageData.length == 0) {
      console.log("Fehler: Lager ist leer.")
      return;
   }

   if (!gwData) {
      console.log('API Call failed');
      return;
   }
   const ownAreas = gwData.ownAreas;

   const itemList = []

   ownAreas.forEach(gw => {
      let item = itemList.find((f) => f.ID == gw.ItemID)
      if (!item) {
         item = { ID: gw.ItemID, Amount: gw.Amount }
      }
      else {
         item.Amount += gw.Amount
      }
      item.ItemWeight = serverItems.find((i) => i.ID == gw.ItemID).Weight || 0;
      itemList.push(item)
   });
   console.log(itemList);

   const maxWeight = storageData[0].maxWeight;

   let totalWeight = 0;
   storageData.forEach(item => {
      const sItem = serverItems[item.item]
      if(!sItem) return;
      if (item.Weight)
         totalWeight += sItem.Weight * item.Amount;
   });

   function calculateTimeUntilFull(totalWeight, maxWeight, itemList) {
      // Berechne das Gesamtgewicht, das pro Stunde hinzugefügt wird
      const weightPerHour = itemList.reduce((acc, item) => acc + (item.ItemWeight * item.Amount), 0);
  
      // Berechne die verbleibende Kapazität
      const remainingCapacity = maxWeight - totalWeight;
  
      // Berechne die Zeit bis zur vollen Kapazität in Stunden
      if (weightPerHour > 0) {
          return Math.floor(remainingCapacity / weightPerHour);
      } else {
          return -1; // Wenn keine Items pro Stunde hinzugefügt werden, wird das Lager nie voll
      }
  }

  const timeUntilFull = calculateTimeUntilFull(totalWeight, maxWeight, itemList);

   res.render('tracker/gwStorage', {
      title: 'GW Lagerplatz',
      itemList,
      maxWeight,
      totalWeight,
      timeUntilFull
   })
}

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
