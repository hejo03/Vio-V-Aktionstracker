const axios = require('axios');
const qs = require('qs');
const db = require('../models').sequelize;
const jwt = require('jsonwebtoken');
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const API_URL = 'https://apiv1.vio-v.com';
const API_V3_URL = `${API_URL}/api/v3`;

async function fetchOnlinePlayers() {
   try {
      const response = await axios.get(`${API_URL}/online_players`);
      const onlinePlayers = Number(response.data?.online_players);
      if (!Number.isFinite(onlinePlayers) || onlinePlayers < 0) {
         throw new Error('Online-player API response did not contain a valid player count');
      }
      return onlinePlayers;
   } catch (error) {
      console.error('fetchOnlinePlayers error:', error.message);
      return null;
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
   });

   try {
      const token_data = await axios.post(`${API_URL}/api/oauth2/token`, data, {
         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const { access_token, refresh_token } = token_data.data;
      if (!access_token) throw new Error('Vio OAuth response did not contain an access token');

      user.vio_access_token = access_token;
      if (refresh_token) user.vio_refresh_token = refresh_token;
      await user.save();
      return access_token;
   } catch (error) {
      console.log(
         `Vio-API Error: ${error.config?.url || API_URL}/api/oauth2/token - ${error.response?.status} - ${error.response?.statusText} - ${error.response?.data?.error_description || error.message}`
      );

      const oauthError = error.response?.data?.error;
      const errorDescription = error.response?.data?.error_description || error.message;
      if (oauthError === 'invalid_grant' || errorDescription.toLowerCase().includes('revoked')) {
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

   const accessTokenData = vio_access_token ? jwt.decode(vio_access_token) : null;
   if (!accessTokenData || typeof accessTokenData.exp !== 'number' || accessTokenData.exp <= Math.floor(Date.now() / 1000)) {
      vio_access_token = await getAccessToken(user.id);
   }

   if (!vio_access_token) return null;

   try {
      const data = await axios.get(`${API_V3_URL}${path}`, {
         headers: { Authorization: `Bearer ${vio_access_token}` },
      });
      return data.data;
   } catch (error) {
      console.log(
         `Vio-API Error: ${error.config?.url || `${API_V3_URL}${path}`} - ${error.response?.status} - ${error.response?.statusText} - ${error.response?.data?.error_description || error.message}`
      );

      const oauthError = error.response?.data?.error;
      const errorDescription = error.response?.data?.error_description || error.message;
      if (oauthError === 'invalid_grant' || errorDescription.toLowerCase().includes('revoked')) {
         user.vio_access_token = null;
         user.vio_refresh_token = null;
         await user.save();
      }
      return null;
   }
}

module.exports = { fetchOnlinePlayers, getAccessToken, getData };
