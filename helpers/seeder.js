const { config } = require('../config');

const gangDefaults = [
   { name: 'Gangwar', points: 20 },
   { name: 'Groupwar', points: 15 },
   { name: 'Humane Labs Raub', points: 25 },
   { name: 'F.I.B. Raub', points: 20 },
   { name: 'Bankraub', points: 15 },
   { name: 'Gefängnisausbruch', points: 15 },
   { name: 'Kunstraub', points: 12 },
   { name: 'Tresorraub', points: 10 },
   { name: 'Geiselnahme', points: 10 },
   { name: 'Ammunation Raub', points: 8 },
   { name: 'Zeugenelimination', points: 8 },
   { name: 'Geldtransporter Angriff', points: 8 },
   { name: 'Munitionstransporter Angriff', points: 7 },
   { name: 'Beweismitteltransporter Angriff', points: 7 },
   { name: 'Waffentruck', points: 5 },
   { name: 'Bündnis-Einsatz', points: 10 },
];

const squadDefaults = [
   { name: 'Groupwar', points: 20 },
   { name: 'Fabrik einnehmen', points: 15 },
   { name: 'Fabrik bewachen', points: 10 },
   { name: 'Produktionshalle', points: 8 },
   { name: 'Tresorraub', points: 10 },
   { name: 'Kunstraub', points: 12 },
   { name: 'Ammunation Raub', points: 8 },
   { name: 'Geldtransporter Angriff', points: 8 },
   { name: 'Waffentruck', points: 5 },
   { name: 'Beweismitteltransporter Angriff', points: 7 },
   { name: 'Hubschrauber Wrack', points: 5 },
   { name: 'Bündnis-Einsatz', points: 10 },
];

async function seedOperationTypes(db) {
   const count = await db.models.OperationType.count();
   if (count > 0) return;

   const defaults = config.groupType === 'squad' ? squadDefaults : gangDefaults;
   await db.models.OperationType.bulkCreate(defaults);
   console.log(`✅ Seeded ${defaults.length} OperationTypes (${config.groupType} mode)`);
}

module.exports = { seedOperationTypes };
