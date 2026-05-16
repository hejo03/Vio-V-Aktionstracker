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
   console.log('[checkFactoryAttacks] Cron gestartet');

   const gwData = await getOrInitGWData(db);
   if (!gwData) {
      console.log('[checkFactoryAttacks] GWData nicht gefunden – Abbruch');
      return;
   }
   if (gwData.invalidToken) {
      console.log('[checkFactoryAttacks] Token ungültig (invalidToken=true) – Abbruch');
      return;
   }

   const findUserWithToken = await findValidUser(db, gwData);
   if (!findUserWithToken) {
      console.log('[checkFactoryAttacks] Kein gültiger User mit Token gefunden – Abbruch');
      return;
   }
   console.log(`[checkFactoryAttacks] User gefunden: ID=${findUserWithToken.id}`);

   // own_factories = Fabriken die wir besitzen (entspricht ownAreas)
   // factories     = alle Fabriken auf der Map  (entspricht allAreas)
   console.log('[checkFactoryAttacks] Rufe API ab: /group/own_factories und /group/factories');
   const ownFactories = await getData(findUserWithToken.id, '/group/own_factories');
   const allFactories = await getData(findUserWithToken.id, '/group/factories');

   if (!ownFactories) {
      console.log('[checkFactoryAttacks] API Call /group/own_factories fehlgeschlagen – Abbruch');
      return;
   }
   console.log(`[checkFactoryAttacks] API-Ergebnis: ${ownFactories.length} eigene Fabrik(en), ${allFactories ? allFactories.length : 'n/a'} Fabriken gesamt`);

   let lastData = gwData.lastFactoryData ? JSON.parse(gwData.lastFactoryData) : [];
   console.log(`[checkFactoryAttacks] Letzter Stand: ${lastData.length} Fabrik(en) in DB gespeichert`);

   // eigene Fabriken durchgehen
   ownFactories.forEach((factory) => {
      let lastEntry = lastData.find((f) => f.ID == factory.ID);
      const index = lastData.findIndex((f) => f.ID == factory.ID);
      const itemInfo = factory.Item ? `\n> Item: ${factory.Item.Name}` : '';

      if (lastEntry) {
         if (lastEntry.NextCapture === undefined) {
            // Migration: altes Format ohne NextCapture → nur aktualisieren, kein Alert
            console.log(`[checkFactoryAttacks] Fabrik ID=${factory.ID}: Migration altes Format – aktualisiere NextCapture ohne Alert`);
            lastData[index] = { ID: factory.ID, NextCapture: factory.NextCapture };
         } else if (lastEntry.NextCapture !== factory.NextCapture) {
            console.log(`[checkFactoryAttacks] Fabrik ID=${factory.ID} (${factory.Type}) ANGEGRIFFEN – NextCapture: ${lastEntry.NextCapture} → ${factory.NextCapture}`);
            sendDiscordNotification(CUSTOM_ATTACK_MESSAGE, `> Typ: ${factory.Type}${itemInfo}`, 0xa83232, true, 'Fabrik');
            lastData[index] = { ID: factory.ID, NextCapture: factory.NextCapture };
         } else {
            console.log(`[checkFactoryAttacks] Fabrik ID=${factory.ID} (${factory.Type}): kein Angriff, NextCapture unverändert (${factory.NextCapture})`);
         }
      } else {
         // Fabrik neu eingenommen
         console.log(`[checkFactoryAttacks] Fabrik ID=${factory.ID} (${factory.Type}): NEU EINGENOMMEN – zu lastData hinzugefügt`);
         lastData.push({ ID: factory.ID, NextCapture: factory.NextCapture });
         sendDiscordNotification('Die Fabrik wurde erfolgreich eingenommen!', `> Typ: ${factory.Type}${itemInfo}`, 0x00a800, false, 'Fabrik');
      }
   });

   // Einträge in lastData, die nicht mehr in ownFactories sind => Fabrik verloren
   console.log('[checkFactoryAttacks] Prüfe auf verlorene Fabriken...');
   for (const lastEntry of lastData.slice()) {
      const stillOwned = ownFactories.find((f) => f.ID == lastEntry.ID);
      if (stillOwned) continue;

      console.log(`[checkFactoryAttacks] Fabrik ID=${lastEntry.ID} nicht mehr in own_factories – als verloren markiert`);
      const objWithIdIndex = lastData.findIndex((obj) => obj.ID === lastEntry.ID);
      if (objWithIdIndex > -1) {
         const memberlist = await getData(findUserWithToken.id, '/group/members');
         if (!memberlist) {
            console.log('[checkFactoryAttacks] API Call /group/members fehlgeschlagen – Abbruch');
            return;
         }

         const onlinePlayers = memberlist.filter((f) => f.Online == 1);
         console.log(`[checkFactoryAttacks] Mitgliederliste: ${memberlist.length} Mitglieder, ${onlinePlayers.length} online`);

         const factoryData = allFactories ? allFactories.find((f) => f.ID == lastEntry.ID) : null;
         if (!factoryData) {
            console.log(`[checkFactoryAttacks] Fabrik ID=${lastEntry.ID} nicht in /group/factories gefunden – kein Discord-Alert`);
         }

         if (factoryData) {
            const itemInfo = factoryData.Item ? `\n> Item: ${factoryData.Item.Name}` : '';
            console.log(`[checkFactoryAttacks] Sende Discord-Alert: Fabrik ID=${lastEntry.ID} (${factoryData.Type}) verloren, Offlineattack=${onlinePlayers.length === 0}`);
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
   console.log(`[checkFactoryAttacks] Abgeschlossen – ${lastData.length} Fabrik(en) in DB gespeichert`);
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
