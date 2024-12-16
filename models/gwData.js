'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
   class GWData extends Model {
      /**
       * Helper method for defining associations.
       * This method is not a part of Sequelize lifecycle.
       * The `models/index` file will call this method automatically.
       */
      static associate(models) {}
   }
   GWData.init(
      {
         lastCheck: DataTypes.DATE,
         lastData: DataTypes.TEXT('long'),
         invalidToken: { type: DataTypes.BOOLEAN, defaultValue: false },
         notifyFullStorage: { type: DataTypes.BOOLEAN, defaultValue: false },
      },
      {
         sequelize,
         modelName: 'GWData',
      }
   );
   return GWData;
};
