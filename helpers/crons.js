let cron = require('node-cron');
const { sendLog, sendDiscordNotification } = require('../helpers/utility');
const { getData } = require('./vioHandler');
const { Op } = require('sequelize');
const db = require('../models').sequelize;
const moment = require('moment');
moment.locale('de');

// checkGangwarAttacks();
checkStorageWeight();
//alle 1min
cron.schedule(
   '*/1 * * * *',
   async () => {
      await checkGangwarAttacks();
   },
   {}
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
   23: 'Hanf',
   64: 'Markiertes Geld',
};

async function checkGangwarAttacks() {
   const gwData = await db.models.GWData.findByPk(1);
   if (!gwData) {
      await db.models.GWData.create({});
      return;
   }
   if (gwData.invalidToken) return;

   const findUserWithToken = await db.models.User.findOne({
      where: { [Op.not]: { vio_refresh_token: null } },
   });

   if (!findUserWithToken) {
      gwData.invalidToken = true;
      await gwData.save();
      sendLog(`Fehler: Es wurde kein User mit einem gültigem API Token. Bitte auf der Aktionstracker Seite neu anmelden.`, 2);
      return;
   }

   const data = await getData(findUserWithToken.id, '/group/areas');
   if (!data) {
      console.log('API Call failed');
      return;
   }
   const allAreas = data.allAreas;
   const ownAreas = data.ownAreas;

   let lastData = gwData.lastData ? JSON.parse(gwData.lastData) : [];
   // console.log(allAreas);
   // console.log(ownAreas);
   // console.log(lastData);

   //checking:
   ownAreas.forEach((gw) => {
      let gwData = lastData.find((f) => f.ID == gw.ID);
      const index = lastData.findIndex((f) => f.ID == gw.ID);
      // console.log(gw.ID, gwData, index);
      if (gwData) {
         if (gwData.LastAttack !== gw.LastAttack) {
            sendDiscordNotification(`Das Gebiet wird gerade angegriffen!`, `> Name: ${gw.Name}\n> Item: ${gw.Amount}x ${ItemList[gw.ItemID]}`, 0xa83232);
            gwData = { ID: gw.ID, LastAttack: gw.LastAttack };
            lastData[index] = gwData;
         }
      } else {
         const newGW = { ID: gw.ID, LastAttack: gw.LastAttack };
         lastData.push(newGW);
         sendDiscordNotification(
            `Das Gebiet wurde erfolgreich eingenommen!`,
            `> Name: ${gw.Name}\n> Item: ${gw.Amount}x ${ItemList[gw.ItemID]}\n> Besitzer: ${gw.OldOwnerName}`,
            0x00a800
         );
      }
   });

   for (const gwData of lastData) {
      const search = ownAreas.find((f) => f.ID == gwData.ID);
      if (search) continue;
      const objWithIdIndex = lastData.findIndex((obj) => obj.ID === gwData.ID);

      if (objWithIdIndex > -1) {
         const memberlist = await getData(findUserWithToken.id, '/group/members');
         if (!memberlist) return;
         const onlinePlayers = memberlist.filter((f) => f.Online == 1);
         const data = allAreas.find((f) => f.ID == gwData.ID);
         if (data)
            sendDiscordNotification(
               `Das Gebiet wurde eingenommen!`,
               `> Name: ${data.Name}\n> Item: ${data.Amount}x ${ItemList[data.ItemID]}\n${onlinePlayers == 0 ? `\n> Status: Offlineattack` : ``}`,
               0xa83232
            );
         lastData.splice(objWithIdIndex, 1);
      }
   }

   gwData.lastCheck = moment(new Date()).toDate();
   gwData.lastData = JSON.stringify(lastData);

   await gwData.save().catch((error) => console.error('Fehler beim Speichern:', error));
}

async function checkStorageWeight() {
   const gwData = await db.models.GWData.findByPk(1);
   if (!gwData) {
      await db.models.GWData.create({});
      return;
   }
   if (gwData.invalidToken) return;

   const findUserWithToken = await db.models.User.findOne({
      where: { [Op.not]: { vio_refresh_token: null } },
   });

   if (!findUserWithToken) {
      gwData.invalidToken = true;
      await gwData.save();
      sendLog(`Fehler: Es wurde kein User mit einem gültigem API Token. Bitte auf der Aktionstracker Seite neu anmelden.`, 2);
      return;
   }

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
   if (totalWeight >= storageData[0].maxWeight) {
      if (gwData.notifyFullStorage) return; //Nachricht bereits gesendet
      sendDiscordNotification(`Das Gruppenlager ist voll!`, `> Gesamtgewicht: ${Math.floor(totalWeight)}\n> Maximalgewicht: ${storageData[0].maxWeight}`, 0xa83232);
   } else if (percentage >= 90) {
      if (gwData.notifyFullStorage) return; //Nachricht bereits gesendet
      sendDiscordNotification(
         `Das Gruppenlager ist fast voll!`,
         `> Gesamtgewicht: ${Math.floor(totalWeight)}\n> Maximalgewicht: ${storageData[0].maxWeight}\n> Prozent: ${Math.floor(percentage)}%`,
         0xa83232
      );
   }
}
