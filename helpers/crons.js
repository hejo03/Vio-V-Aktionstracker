let cron = require('node-cron');
const { sendLog, sendDiscordNotification } = require('../helpers/utility');
const { fetchOnlinePlayers, getData } = require('./vioHandler');
const { Op, Sequelize, DataTypes } = require('sequelize');
const db = require('../models').sequelize;
const moment = require('moment');
moment.locale('de');

checkGangwarAttacks();
//alle 1min
cron.schedule(
   '*/3 * * * *',
   async () => {
      await checkGangwarAttacks();
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
   gwData.lastCheck = moment(new Date()).toDate();
   await gwData.save();

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
   // const allAreas = data.allAreas;
   const ownAreas = data.ownAreas;

   let lastData = JSON.parse(gwData.lastData);
   if (!lastData) lastData = [];
   // console.log(allAreas);
   // console.log(ownAreas);
   // console.log(lastData);

   //checking:
   ownAreas.forEach((gw) => {
      let gwData = lastData.find((f) => f.ID == gw.ID);
      const index = lastData.findIndex((f) => f.ID == gw.ID);
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

   lastData.forEach((gwData) => {
      const search = ownAreas.find((f) => f.ID == gwData.ID);
      if (search) return;
      const objWithIdIndex = lastData.findIndex((obj) => obj.ID === gwData.ID);

      if (objWithIdIndex > -1) {
         const memberlist = getData(findUserWithToken.id, '/group/members');
         const onlinePlayers = memberlist.filter((f) => f.Online == 1);
         sendDiscordNotification(
            `Das Gebiet wurde eingenommen!`,
            `> Name: ${gwData.Name}\n> Item: ${gwData.Amount}x ${ItemList[gwData.ItemID]}\n${onlinePlayers == 0 ? `\n> Status: Offlineattack` : ``}`,
            0xa83232
         );
         lastData.splice(objWithIdIndex, 1);
      }
   });

   gwData.lastData = JSON.stringify(lastData);
   await gwData.save();
}
