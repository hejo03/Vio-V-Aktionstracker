const fetch = require('fetch');
const { config } = require('../config');
const { logHook } = config;
const { WebhookClient, EmbedBuilder } = require('discord.js');

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
   const webhookClient = new WebhookClient({ url: logHook });
   const embed = new EmbedBuilder();
   switch (type) {
      case 0:
         embed.setTitle('Info');
         break;
      case 1:
         embed.setTitle('Wichtig');
         break;
      case 2:
         embed.setTitle('Error');
         break;
      case 3:
         embed.setTitle('Aktion');
         break;
   }
   embed.setDescription(mes).setColor(0x2f3136).setTimestamp();
   webhookClient.send({ embeds: [embed], username: 'Tracker Logs' }).catch((err) => console.log(err));
}

module.exports = {
   generateRandomString,
   asyncFetch,
   catchAsyncErrors,
   sendLog,
};
