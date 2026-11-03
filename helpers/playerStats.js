const { Op } = require('sequelize');
const db = require('../models').sequelize;
const { fetchOnlinePlayers, getData } = require('./vioHandler');

async function getPlayerStats(userId) {
   const user = userId
      ? await db.models.User.findByPk(userId)
      : await db.models.User.findOne({ where: { vio_refresh_token: { [Op.ne]: null } } });

   if (!user || !user.vio_refresh_token) return null;

   const [settings, onlinePlayerCount] = await Promise.all([getData(user.id, '/system/settings'), fetchOnlinePlayers()]);
   if (!Array.isArray(settings) || onlinePlayerCount === null) return null;

   const thresholdSetting = settings.find((setting) => setting.Setting === 'TotalPlayersForSkip');
   const playerThreshold = Number(thresholdSetting?.Value);
   if (!Number.isFinite(playerThreshold) || playerThreshold <= 0) {
      console.error('Player statistics: system/settings did not contain a valid TotalPlayersForSkip value');
      return null;
   }

   return { onlinePlayerCount, playerThreshold };
}

module.exports = { getPlayerStats };
