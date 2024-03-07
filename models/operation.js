'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
   class Operation extends Model {
      /**
       * Helper method for defining associations.
       * This method is not a part of Sequelize lifecycle.
       * The `models/index` file will call this method automatically.
       */
      static associate(models) {
         this.belongsTo(models.OperationType, { foreignKey: 'type' });
         this.belongsToMany(models.User, { through: 'user_operation' });
      }
   }
   Operation.init(
      {
         type: DataTypes.INTEGER,
         comment: DataTypes.STRING,
         valid: DataTypes.BOOLEAN,
         timestamp: DataTypes.DATE,
         createdAt: DataTypes.DATE,
      },
      {
         sequelize,
         modelName: 'Operation',
      }
   );
   return Operation;
};
