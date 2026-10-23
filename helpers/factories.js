const GROUP_FACTORIES = {
   1: { type: 'Schwarzpulverfabrik', name: '2. See', item: 'Schwarzpulver' },
   2: { type: 'Gießerei', name: 'Grapeseed (unten)', item: 'Metallteile' },
   3: { type: 'Geldwäscherei', name: 'Elysian Island', item: 'Gereinigter Geldschein' },
   4: { type: 'Gießerei', name: 'Windpark', item: 'Metallteile' },
   5: { type: 'Schwarzpulverfabrik', name: '3. See', item: 'Schwarzpulver' },
   6: { type: 'Gießerei', name: 'Ölfelder', item: 'Metallteile' },
   7: { type: 'Geldwäscherei', name: 'Grapeseed (oben)', item: 'Gereinigter Geldschein' },
   8: { type: 'Geldwäscherei', name: '1. See', item: 'Gereinigter Geldschein' },
   9: { type: 'Munitionsfabrik', name: 'Cayo Perico 1', item: 'Munition D' },
   10: { type: 'Munitionsfabrik', name: 'Cayo Perico 2', item: 'Munition D' },
   11: { type: 'Gießerei', name: 'Vinewood', item: 'Metallteile' },
   12: { type: 'Geldwäscherei', name: 'Terminal', item: 'Gereinigter Geldschein' },
};

function getFactoryDetails(factoryId) {
   return GROUP_FACTORIES[factoryId] || { type: 'Fabrik', name: 'Unbekannter Standort', item: 'Unbekanntes Produkt' };
}

function mapFactories(factories) {
   return factories.map((factory) => ({
      ...factory,
      ...getFactoryDetails(factory.ID),
   }));
}

module.exports = { getFactoryDetails, mapFactories };
