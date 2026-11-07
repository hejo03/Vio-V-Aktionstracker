const fetch = require('fetch');
const { config } = require('../config');
const { EmbedBuilder } = require('discord.js');
const { sendToConfiguredGuilds } = require('./discordBot');

function generateRandomString(length) {
   let result = '';
   const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   const charactersLength = characters.length;
   for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

async function asyncFetch(url) {
   return new Promise((resolve, reject) => {
      fetch.fetchUrl(url, null, (error, meta, body) => {
         if (error) {
            reject(error);
            return;
         }
         resolve(body.toString());
      });
   });
}

const catchAsyncErrors = (fn) => (req, res, next) => {
   const routePromise = fn(req, res, next);
   if (routePromise.catch) {
      routePromise.catch((err) => next(err));
   }
};

async function sendLog(mes = '', type = 0) {
   const embed = new EmbedBuilder();
   let title = 'Info';
   switch (type) {
      case 0:
         break;
      case 1:
         title = 'Wichtig';
         break;
      case 2:
         title = 'Error';
         break;
      case 3:
         title = 'Aktion';
         break;
   }
   embed.setTitle(title).setDescription(mes).setColor(0x2f3136).setTimestamp();
   try {
      const sent = await sendToConfiguredGuilds('logChannelId', () => ({ embeds: [embed] }));
      if (!sent) console.log(`[Tracker ${title}] ${mes}`);
   } catch (error) {
      console.error('Discord log delivery failed:', error);
      console.log(`[Tracker ${title}] ${mes}`);
   }
}

async function sendDiscordNotification(title, description, color = 0x2b2d31, ping = true, author = 'Gangwar') {
   const embed = new EmbedBuilder();
   embed.setAuthor({ name: author }).setColor(color).setTimestamp().setTitle(title).setDescription(description);
   try {
      const sent = await sendToConfiguredGuilds('notificationChannelId', (guildConfig) => {
         const roleId = ping ? guildConfig.notificationRoleId : null;
         const notificationEmbed = embed.toJSON();
         if (ping && guildConfig.attackMessage) notificationEmbed.title = guildConfig.attackMessage;
         return {
            content: roleId ? `<@&${roleId}>` : '',
            embeds: [notificationEmbed],
            allowedMentions: { roles: roleId ? [roleId] : [] },
         };
      });
      if (sent === false) console.warn('Discord alert could not be delivered; see the Discord bot error above.');
   } catch (error) {
      console.error('Discord alert delivery failed:', error);
   }
}

async function sendPlayerLimitNotification(onlinePlayerCount, playerThreshold) {
   const embed = new EmbedBuilder()
      .setTitle('Spielergrenze erreicht')
      .setDescription(`Aktuell sind **${onlinePlayerCount} Spieler** online.\nDie Spielergrenze liegt bei **${playerThreshold} Spielern**.`)
      .setColor(0xa83232)
      .setTimestamp();

   const sent = await sendToConfiguredGuilds('playerLimitChannelId', (guildConfig) => {
      return {
         embeds: [embed],
      };
   });
   return sent === true;
}

module.exports = {
   generateRandomString,
   asyncFetch,
   catchAsyncErrors,
   sendLog,
   sendDiscordNotification,
   sendPlayerLimitNotification,
};
