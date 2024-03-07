const axios = require('axios');
const db = require('../models').sequelize;
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const { config } = require('../config');
const { access } = require('fs');
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const redirectUri = process.env.redirectUri;
const API_URL = 'https://apiv1.vio-v.com';

async function fetchOnlinePlayers() {
   axios
      .get('https://apiv1.vio-v.com/online_players')
      .then((response) => {
         return response.data.online_players;
      })
      .catch((error) => {
         return 0;
      });
}

async function getAccessToken(userId) {
   const user = await db.models.User.findByPk(userId);
   if (!user || !user.vio_refresh_token) return null;

   const data = new URLSearchParams();
   data.append('client_id', CLIENT_ID);
   data.append('client_secret', CLIENT_SECRET);
   data.append('refresh_token', user.vio_refresh_token);
   data.append('grant_type', 'refresh_token');
   data.append('redirect_uri', redirectUri);

   const token_data = await fetch(`${API_URL}/api/oauth2/token`, {
      method: 'POST',
      body: data.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
   });

   if (token_data.status !== 200) {
      const errorCode = await token_data.text();
      console.log(`Vio-API Error: ${token_data.url} - ${token_data.status} - ${token_data.statusText} - ${await errorCode}`);

      if (errorCode.includes('revoked')) {
         user.vio_access_token = null;
         user.vio_refresh_token = null;
         await user.save();
      }
      return null;
   }
   const { access_token, refresh_token } = await token_data.json();

   user.vio_access_token = access_token;
   user.vio_refresh_token = refresh_token; //<-- important!!
   await user.save();
   return access_token;
}

async function getData(userId, path) {
   const user = await db.models.User.findByPk(userId);
   if (!user) return null;

   let { vio_access_token } = user;
   if (!vio_access_token) {
      vio_access_token = await getAccessToken(user.id);
   }

   const accessTokenData = jwt.decode(vio_access_token);
   if (!accessTokenData) {
      vio_access_token = await getAccessToken(user.id);
   } else if (accessTokenData.exp < Math.floor(Date.now() / 1000)) {
      vio_access_token = await getAccessToken(user.id);
   }
   if (!vio_access_token) return null;
   const data = await fetch(`${API_URL}/api/v3${path}`, { headers: { Authorization: 'Bearer ' + vio_access_token } });
   if (data.status !== 200) {
      const errorCode = await data.text();
      console.log(`Vio-API Error: ${data.url} - ${data.status} - ${data.statusText} - ${await errorCode}`);

      if (errorCode.includes('revoked')) {
         sendDiscordDebug('api token revoked', `${user.name} - ${path}`);
         user.vio_access_token = null;
         user.vio_refresh_token = null;
         await user.save();
      }
      return null;
   }

   return await data.json();
}

module.exports = { fetchOnlinePlayers, getAccessToken, getData };
