let cron = require('node-cron');
const { sendLog, sendDiscordNotification } = require('../helpers/utility');
const { getData } = require('./vioHandler');
const { Op } = require('sequelize');
const { config } = require('../config');
const { CUSTOM_ATTACK_MESSAGE, groupType } = config;
const db = require('../models').sequelize;
const moment = require('moment');
moment.locale('de');

// checkGangwarAttacks();
// checkFactoryAttacks();
// checkStorageWeight();

//alle 1min
cron.schedule(
   '*/1 * * * *',
   async () => {
      if (groupType === 'squad') {
         await checkFactoryAttacks();
      } else {
         await checkGangwarAttacks();
      }
   },
   {
      noOverlap: true,
      timezone: 'Europe/Berlin',
   }
);

// alle 60min
cron.schedule(
   '*/60 * * * *',
   async () => {
      await checkStorageWeight();
   },
   {}
);

const ItemList = {
   0: 'Bargeld',
   5: '40%tiges Methylamin',
   10: 'Metallteile',
   17: 'Gold',
   21: 'Schwarzpulver',
   22: 'Hanf-Steckling',
   23: 'Hanf',
   64: 'Markiertes Geld',
};

async function getOrInitGWData(db) {
   const gwData = await db.models.GWData.findByPk(1);
   if (!gwData) {
      await db.models.GWData.create({});
      return null;
   }
   return gwData;
}

async function findValidUser(db, gwData) {
   const user = await db.models.User.findOne({
      where: { [Op.not]: { vio_refresh_token: null } },
   });
   if (!user) {
      gwData.invalidToken = true;
      await gwData.save();
      sendLog('Fehler: Es wurde kein User mit einem gültigem API Token. Bitte auf der Aktionstracker Seite neu anmelden.', 2);
   }
   return user;
}

async function checkGangwarAttacks() {
   const gwData = await getOrInitGWData(db);
   if (!gwData) return;
   if (gwData.invalidToken) return;

   const findUserWithToken = await findValidUser(db, gwData);
   if (!findUserWithToken) return;

   const data = await getData(findUserWithToken.id, '/group/areas');
   if (!data) {
      console.log('API Call failed');
      return;
   }

   const allAreas = data.allAreas;
   const ownAreas = data.ownAreas;

   let lastData = gwData.lastData ? JSON.parse(gwData.lastData) : [];

   // eigene Gebiete durchgehen
   ownAreas.forEach((gw) => {
      let lastEntry = lastData.find((f) => f.ID == gw.ID);
      const index = lastData.findIndex((f) => f.ID == gw.ID);

      if (lastEntry) {
         if (lastEntry.LastAttack !== gw.LastAttack) {
            console.log(gw.ID);
            console.log('Last: ' + new Date(lastEntry.LastAttack * 1000));
            console.log(new Date(gw.LastAttack * 1000));
            sendDiscordNotification(CUSTOM_ATTACK_MESSAGE, `> Name: ${gw.Name}\n> Item: ${gw.Amount}x ${ItemList[gw.ItemID] ? ItemList[gw.ItemID] : gw.ItemID}`, 0xa83232, true);
            lastEntry = { ID: gw.ID, LastAttack: gw.LastAttack };
            lastData[index] = lastEntry;
         }
      } else {
         const newGW = { ID: gw.ID, LastAttack: gw.LastAttack };
         lastData.push(newGW);
         sendDiscordNotification(
            'Das Gebiet wurde erfolgreich eingenommen!',
            `> Name: ${gw.Name}\n> Item: ${gw.Amount}x ${ItemList[gw.ItemID] ? ItemList[gw.ItemID] : gw.ItemID}\n> Besitzer: ${gw.OldOwnerName}`,
            0x00a800,
            false
         );
      }
   });

   // Einträge in lastData, die nicht mehr zu ownAreas gehören => Gebiet verloren
   for (const lastEntry of lastData.slice()) {
      const stillOwned = ownAreas.find((f) => f.ID == lastEntry.ID);
      if (stillOwned) continue;

      const objWithIdIndex = lastData.findIndex((obj) => obj.ID === lastEntry.ID);
      if (objWithIdIndex > -1) {
         const memberlist = await getData(findUserWithToken.id, '/group/members');
         if (!memberlist) return;

         const onlinePlayers = memberlist.filter((f) => f.Online == 1);
         const areaData = allAreas.find((f) => f.ID == lastEntry.ID);

         if (areaData) {
            sendDiscordNotification(
               'Das Gebiet wurde eingenommen!',
               `> Name: ${areaData.Name}\n> Item: ${areaData.Amount}x ${
                  ItemList[areaData.ItemID] ? ItemList[areaData.ItemID] : areaData.ItemID
               }\n${onlinePlayers.length === 0 ? '\n> Status: Offlineattack' : ''}`,
               0xa83232,
               false
            );
         }

         lastData.splice(objWithIdIndex, 1);
      }
   }

   gwData.lastCheck = moment(new Date()).toDate();
   gwData.lastData = JSON.stringify(lastData);

   await gwData.save();
}

async function checkFactoryAttacks() {
   const gwData = await getOrInitGWData(db);
   if (!gwData) return;
   if (gwData.invalidToken) return;

   const findUserWithToken = await findValidUser(db, gwData);
   if (!findUserWithToken) return;

   // own_factories = Fabriken die wir besitzen (entspricht ownAreas)
   // factories     = alle Fabriken auf der Map  (entspricht allAreas)
   const ownFactories = await getData(findUserWithToken.id, '/group/own_factories');
   const allFactories = await getData(findUserWithToken.id, '/group/factories');

   if (!ownFactories) {
      console.log('API Call /group/own_factories failed');
      return;
   }

   let lastData = gwData.lastFactoryData ? JSON.parse(gwData.lastFactoryData) : [];

   // eigene Fabriken durchgehen
   ownFactories.forEach((factory) => {
      let lastEntry = lastData.find((f) => f.ID == factory.ID);
      const index = lastData.findIndex((f) => f.ID == factory.ID);
      const itemInfo = factory.Item ? `\n> Item: ${factory.Item.Name}` : '';

      if (lastEntry) {
         if (lastEntry.NextCapture === undefined) {
            // Migration: altes Format ohne NextCapture → nur aktualisieren, kein Alert
            lastData[index] = { ID: factory.ID, NextCapture: factory.NextCapture };
         } else if (lastEntry.NextCapture !== factory.NextCapture) {
            console.log(`Fabrik angegriffen: ${factory.ID}`);
            sendDiscordNotification(
               CUSTOM_ATTACK_MESSAGE,
               `> Typ: ${factory.Type}${itemInfo}`,
               0xa83232,
               true,
               'Fabrik'
            );
            lastData[index] = { ID: factory.ID, NextCapture: factory.NextCapture };
         }
      } else {
         // Fabrik neu eingenommen
         lastData.push({ ID: factory.ID, NextCapture: factory.NextCapture });
         sendDiscordNotification(
            'Die Fabrik wurde erfolgreich eingenommen!',
            `> Typ: ${factory.Type}${itemInfo}`,
            0x00a800,
            false,
            'Fabrik'
         );
      }
   });

   // Einträge in lastData, die nicht mehr in ownFactories sind => Fabrik verloren
   for (const lastEntry of lastData.slice()) {
      const stillOwned = ownFactories.find((f) => f.ID == lastEntry.ID);
      if (stillOwned) continue;

      const objWithIdIndex = lastData.findIndex((obj) => obj.ID === lastEntry.ID);
      if (objWithIdIndex > -1) {
         const memberlist = await getData(findUserWithToken.id, '/group/members');
         if (!memberlist) return;

         const onlinePlayers = memberlist.filter((f) => f.Online == 1);
         const factoryData = allFactories ? allFactories.find((f) => f.ID == lastEntry.ID) : null;

         if (factoryData) {
            const itemInfo = factoryData.Item ? `\n> Item: ${factoryData.Item.Name}` : '';
            sendDiscordNotification(
               'Die Fabrik wurde eingenommen!',
               `> Typ: ${factoryData.Type}${itemInfo}${onlinePlayers.length === 0 ? '\n> Status: Offlineattack' : ''}`,
               0xa83232,
               false,
               'Fabrik'
            );
         }

         lastData.splice(objWithIdIndex, 1);
      }
   }

   gwData.lastFactoryCheck = moment(new Date()).toDate();
   gwData.lastFactoryData = JSON.stringify(lastData);

   await gwData.save();
}

async function checkStorageWeight() {
   const gwData = await getOrInitGWData(db);
   if (!gwData) return;
   if (gwData.invalidToken) return;

   const findUserWithToken = await findValidUser(db, gwData);
   if (!findUserWithToken) return;

   const serverItems = await getData(findUserWithToken.id, '/system/items');
   const storageData = await getData(findUserWithToken.id, '/group/storage');

   if (!storageData || storageData.length == 0) {
      console.log('API Call failed');
      return;
   }

   let totalWeight = 0;
   storageData.map((item) => {
      const sItem = serverItems.find((i) => i.ID === item.item);
      if (!sItem) return;
      if (sItem.Weight) totalWeight = totalWeight + sItem.Weight * item.amount;
      return item;
   });
   const percentage = (totalWeight / storageData[0].maxWeight) * 100;

   if (percentage < 80) {
      gwData.notifyFullStorage = false;
      gwData.save();
      return;
   }

   if (totalWeight == 0) return;
   if (gwData.notifyFullStorage == true) return;
   gwData.notifyFullStorage = true;
   gwData.save();
   if (totalWeight >= storageData[0].maxWeight) {
      sendDiscordNotification(`Das Gruppenlager ist voll!`, `> Gesamtgewicht: ${Math.floor(totalWeight)}\n> Maximalgewicht: ${storageData[0].maxWeight}`, 0xa83232, false);
   } else if (percentage >= 90) {
      sendDiscordNotification(
         `Das Gruppenlager ist fast voll!`,
         `> Gesamtgewicht: ${Math.floor(totalWeight)}\n> Maximalgewicht: ${storageData[0].maxWeight}\n> Prozent: ${Math.floor(percentage)}%`,
         0xa83232,
         false
      );
   }
}
