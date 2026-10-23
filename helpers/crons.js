let cron = require('node-cron');
const { sendLog, sendDiscordNotification, sendCollectorNotification } = require('../helpers/utility');
const { fetchOnlinePlayers, getData } = require('./vioHandler');
const { Op } = require('sequelize');
const { config } = require('../config');
const { groupType } = config;
const { getFactoryDetails } = require('./factories');
const db = require('../models').sequelize;
const moment = require('moment');
moment.locale('de');
let collectorCheckRunning = false;

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

cron.schedule(
   '*/1 * * * *',
   async () => {
      if (collectorCheckRunning) return;
      collectorCheckRunning = true;
      try {
         await checkCollectorThreshold();
      } catch (error) {
         console.error('Collector monitoring failed:', error);
      } finally {
         collectorCheckRunning = false;
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
      if (groupType === 'gang') await checkStorageWeight();
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

function formatNextCapture(nextCapture) {
   if (nextCapture == null) return 'Unbekannt';

   const captureDate = moment.unix(Number(nextCapture)).utc();
   if (!captureDate.isValid()) return String(nextCapture);

   return `${nextCapture} (${captureDate.format('DD.MM.YYYY HH:mm:ss [UTC]')})`;
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
   if (!gwData || gwData.invalidToken) return;

   const findUserWithToken = await findValidUser(db, gwData);
   if (!findUserWithToken) return;

   const ownFactories = await getData(findUserWithToken.id, '/group/factories');
   if (!ownFactories) return;

   let lastData = gwData.lastFactoryData ? JSON.parse(gwData.lastFactoryData) : [];

   ownFactories.forEach((factory) => {
      const factoryDetails = getFactoryDetails(factory.ID);
      const factoryDescription = `> Fabrik: ${factoryDetails.name} (#${factory.ID})\n> Typ: ${factoryDetails.type}\n> Next Capture: ${formatNextCapture(factory.NextCapture)}`;
      let lastEntry = lastData.find((f) => f.ID == factory.ID);
      const index = lastData.findIndex((f) => f.ID == factory.ID);

      if (lastEntry) {
         if (lastEntry.NextCapture === undefined) {
            // Migration: altes Format ohne NextCapture → aktualisieren ohne Alert
            lastData[index] = { ID: factory.ID, NextCapture: factory.NextCapture };
         } else if (lastEntry.NextCapture !== factory.NextCapture) {
            sendDiscordNotification('Angriff abgewehrt - Fabrik gehalten!', factoryDescription, 0x00a800, true, 'Fabrik');
            lastData[index] = { ID: factory.ID, NextCapture: factory.NextCapture };
         }
      } else {
         lastData.push({ ID: factory.ID, NextCapture: factory.NextCapture });
         sendDiscordNotification('Die Fabrik wurde erfolgreich eingenommen!', factoryDescription, 0x00a800, false, 'Fabrik');
      }
   });

   for (const lastEntry of lastData.slice()) {
      if (ownFactories.find((f) => f.ID == lastEntry.ID)) continue;

      const objWithIdIndex = lastData.findIndex((obj) => obj.ID === lastEntry.ID);
      if (objWithIdIndex > -1) {
         const memberlist = await getData(findUserWithToken.id, '/group/members');
         if (!memberlist) return;

         const onlinePlayers = memberlist.filter((f) => f.Online == 1);
         const factoryDetails = getFactoryDetails(lastEntry.ID);
         sendDiscordNotification(
            'Fabrik verloren!',
            `> Fabrik: ${factoryDetails.name} (#${lastEntry.ID})\n> Typ: ${factoryDetails.type}\n> Next Capture: ${formatNextCapture(lastEntry.NextCapture)}${
               onlinePlayers.length === 0 ? '\n> Status: Offlineattack' : ''
            }`,
            0xa83232,
            false,
            'Fabrik'
         );
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

async function checkCollectorThreshold() {
   const gwData = await getOrInitGWData(db);
   if (!gwData || gwData.invalidToken) return;

   const user = await findValidUser(db, gwData);
   if (!user) return;

   const [settings, onlinePlayerCount] = await Promise.all([getData(user.id, '/system/settings'), fetchOnlinePlayers()]);
   if (!Array.isArray(settings) || onlinePlayerCount === null) return;

   const thresholdSetting = settings.find((setting) => setting.Setting === 'TotalPlayersForSkip');
   const playerThreshold = Number(thresholdSetting?.Value);
   if (!Number.isFinite(playerThreshold) || playerThreshold <= 0) {
      console.error('Collector monitoring: system/settings did not contain a valid TotalPlayersForSkip value');
      return;
   }

   if (onlinePlayerCount >= playerThreshold) {
      if (gwData.collectorThresholdReached) return;

      try {
         await sendCollectorNotification(`Collector-Grenze erreicht: ${onlinePlayerCount} Spieler online (Grenze: ${playerThreshold}).`);
      } catch (error) {
         console.error('Collector notification failed:', error);
         return;
      }

      gwData.collectorThresholdReached = true;
      await gwData.save();
      return;
   }

   if (gwData.collectorThresholdReached) {
      gwData.collectorThresholdReached = false;
      await gwData.save();
   }
}
