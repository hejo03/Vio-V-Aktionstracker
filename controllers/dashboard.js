const db = require('../models').sequelize;
const { sequelize } = require('../models');
const { getData } = require('../helpers/vioHandler');
const { config } = require('../config');

const GROUP_FACTORIES = {
   1: { type: 'Schwarzpulverfabrik', item: 'Schwarzpulver' },
   2: { type: 'Gießerei', item: 'Metallteile' },
   3: { type: 'Geldwäscherei', item: 'Gereinigter Geldschein' },
   4: { type: 'Gießerei', item: 'Metallteile' },
   5: { type: 'Gießerei', item: 'Metallteile' },
   6: { type: 'Gießerei', item: 'Metallteile' },
   7: { type: 'Geldwäscherei', item: 'Gereinigter Geldschein' },
   8: { type: 'Geldwäscherei', item: 'Gereinigter Geldschein' },
   9: { type: 'Munitionsfabrik', item: 'Munition D' },
   10: { type: 'Munitionsfabrik', item: 'Munition D' },
   11: { type: 'Gießerei', item: 'Metallteile' },
   12: { type: 'Geldwäscherei', item: 'Gereinigter Geldschein' },
};

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
            where: { id: req.user.id },
         },
         'OperationType',
      ],
   });

   res.render('tracker/stats', {
      allTimeOperations: allTimeOperations.count,
      userAllTimeOperationsCount: userAllTimeOperations.count,
      title: 'Statistiken',
   });
};

exports.calcGWStorage = async (req, res) => {
   if (config.groupType === 'squad') return res.redirect('/');
   const storageData = await getData(req.user.id, '/group/storage');
   const serverItems = await getData(req.user.id, '/system/items');
   const gwData = await getData(req.user.id, '/group/areas');
   if (!serverItems) {
      console.log('Fehler: Serveritems nicht gefunden.');
      return;
   }
   if (!storageData || storageData.length == 0) {
      console.log('Fehler: Lager ist leer.');
      return;
   }

   if (!gwData) {
      console.log('API Call failed');
      return;
   }
   const ownAreas = gwData.ownAreas;

   const itemList = [];

   ownAreas.forEach((gw) => {
      let item = itemList.find((f) => f.ID == gw.ItemID);
      if (!item) {
         item = { ID: gw.ItemID, Amount: gw.Amount };
      } else {
         item.Amount += gw.Amount;
      }
      item.ItemWeight = serverItems.find((i) => i.ID == gw.ItemID).Weight || 0;
      itemList.push(item);
   });

   const maxWeight = storageData[0].maxWeight;

   let totalWeight = 0;
   storageData.forEach((item) => {
      const sItem = serverItems[item.item];
      if (!sItem) return;
      if (item.Weight) totalWeight += sItem.Weight * item.Amount;
   });

   function calculateTimeUntilFull(totalWeight, maxWeight, itemList) {
      // Berechne das Gesamtgewicht, das pro Stunde hinzugefügt wird
      const weightPerHour = itemList.reduce((acc, item) => acc + item.ItemWeight * item.Amount, 0);

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
      timeUntilFull,
   });
};

exports.groupOverview = async (req, res) => {
   const PERMISSION_LABELS = {
      cashout: 'Kasse',
      crafting: 'Crafting',
      diplomacy: 'Diplomatie',
      group_factory_lead: 'Fabrik-Leitung',
      group_factory_user: 'Fabrik',
      interior: 'Interieur',
      invite: 'Einladen',
      manage_applications: 'Bewerbungen',
      park: 'Parken',
      rank_down: 'Degradieren',
      rank_up: 'Befördern',
      respawn: 'Respawn',
      set_permission: 'Rechte',
      storage: 'Lager',
      uninvite: 'Rauswerfen',
      vehicle_tuning: 'Fahrzeug-Tuning',
   };

   const [rawMembers, storageData, serverItems, rawRanks] = await Promise.all([
      getData(req.user.id, '/group/members'),
      getData(req.user.id, '/group/storage'),
      getData(req.user.id, '/system/items'),
      getData(req.user.id, '/group/ranks'),
   ]);

   const rankMap = rawRanks ? Object.fromEntries(rawRanks.map((r) => [r.RankID, r.Name])) : {};
   const isLeader = req.user?.Role?.isLeader === true;

   const members = rawMembers
      ? rawMembers
           .map((m) => ({
              ...m,
              rankName: rankMap[m.Rank] ?? `Rang ${m.Rank}`,
              permissions: JSON.parse(m.Permissions || '[]')
                 .filter((p) => !p.startsWith('item_'))
                 .map((p) => PERMISSION_LABELS[p] ?? p),
           }))
           .sort((a, b) => a.Rank - b.Rank)
      : [];

   let areas = null;
   let ownFactories = null;
   let vehicles = null;

   if (config.groupType === 'gang') {
      areas = await getData(req.user.id, '/group/areas');
   } else {
      const rawFactories = await getData(req.user.id, '/group/factories');
      ownFactories = rawFactories
         ? rawFactories.map((f) => ({ ...f, ...GROUP_FACTORIES[f.ID] }))
         : null;
   }

   const rawVehicles = await getData(req.user.id, '/group/vehicles');
   vehicles = rawVehicles
      ? rawVehicles.map((v) => ({
           ...v,
           Health: v.Health != null && v.MaxHealth ? Math.round((v.Health / v.MaxHealth) * 100) : null,
           Fuel: v.Fuel != null && v.MaxFuel ? Math.round((v.Fuel / v.MaxFuel) * 100) : null,
        }))
      : [];

   let totalWeight = 0;
   let maxWeight = 0;
   if (storageData && storageData.length > 0 && serverItems) {
      maxWeight = storageData[0].maxWeight;
      storageData.forEach((item) => {
         const sItem = serverItems.find((i) => i.ID === item.item);
         if (!sItem) return;
         if (sItem.Weight) totalWeight += sItem.Weight * item.amount;
      });
   }

   const onlineMembers = members ? members.filter((m) => m.Online == 1).length : 0;

   res.render('tracker/groupOverview', {
      title: 'Gruppen-Übersicht',
      members: members || [],
      onlineMembers,
      isLeader,
      areas: areas ? areas.ownAreas || [] : null,
      ownFactories: ownFactories || null,
      vehicles: vehicles || [],
      storageData: storageData || [],
      totalWeight: Math.floor(totalWeight),
      maxWeight,
      storagePercent: maxWeight > 0 ? Math.floor((totalWeight / maxWeight) * 100) : 0,
      groupType: config.groupType,
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
