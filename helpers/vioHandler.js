const axios = require('axios');
const qs = require('qs');
const db = require('../models').sequelize;
const jwt = require('jsonwebtoken');
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const redirectUri = process.env.redirectUri;
const API_URL = 'https://apiv1.vio-v.com';

async function fetchOnlinePlayers() {
   try {
      const response = await axios.get(`${API_URL}/online_players`);
      return response.data.online_players;
   } catch (error) {
      console.error('fetchOnlinePlayers error:', error.message);
      return 0;
   }
}

async function getAccessToken(userId) {
   const user = await db.models.User.findByPk(userId);
   if (!user || !user.vio_refresh_token) return null;

   const data = qs.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: user.vio_refresh_token,
      grant_type: 'refresh_token',
      redirect_uri: redirectUri,
   });

   try {
      const token_data = await axios.post(`${API_URL}/api/oauth2/token`, data, {
         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const { access_token, refresh_token } = token_data.data;

      user.vio_access_token = access_token;
      user.vio_refresh_token = refresh_token;
      await user.save();
      return access_token;
   } catch (error) {
      console.log(
         `Vio-API Error: ${error.config?.url || API_URL}/api/oauth2/token - ${error.response?.status} - ${error.response?.statusText} - ${error.response?.data?.error_description || error.message}`
      );

      if (error.response?.data?.error_description?.includes('revoked')) {
         user.vio_access_token = null;
         user.vio_refresh_token = null;
         await user.save();
      }
      return null;
   }
}

async function getData(userId, path) {
   const user = await db.models.User.findByPk(userId);
   if (!user) return null;

   let { vio_access_token } = user;
   if (!vio_access_token) {
      vio_access_token = await getAccessToken(user.id);
   }

   const accessTokenData = jwt.decode(vio_access_token);
   if (!accessTokenData || accessTokenData.exp < Math.floor(Date.now() / 1000)) {
      vio_access_token = await getAccessToken(user.id);
   }

   if (!vio_access_token) return null;

   try {
      const data = await axios.get(`${API_URL}/api/v3${path}`, {
         headers: { Authorization: `Bearer ${vio_access_token}` },
      });
      return data.data;
   } catch (error) {
      console.log(
         `Vio-API Error: ${error.config?.url || `${API_URL}/api/v3${path}`} - ${error.response?.status} - ${error.response?.statusText} - ${error.response?.data?.error_description || error.message}`
      );

      if (error.response?.data?.error_description?.includes('revoked')) {
         sendDiscordDebug('api token revoked', `${user.name} - ${path}`);
         user.vio_access_token = null;
         user.vio_refresh_token = null;
         await user.save();
      }
      return null;
   }
}

module.exports = { fetchOnlinePlayers, getAccessToken, getData };
