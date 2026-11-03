'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
   class DiscordGuildConfig extends Model {}

   DiscordGuildConfig.init(
      {
         guildId: { type: DataTypes.STRING(20), primaryKey: true },
         logChannelId: DataTypes.STRING(20),
         notificationChannelId: DataTypes.STRING(20),
         playerLimitChannelId: DataTypes.STRING(20),
         attackMessage: DataTypes.STRING(1000),
         notificationRoleId: DataTypes.STRING(20),
      },
      {
         sequelize,
         modelName: 'DiscordGuildConfig',
      }
   );

   return DiscordGuildConfig;
};
