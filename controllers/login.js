const db = require('../models').sequelize;
const fetch = require('node-fetch');
const crypto = require('crypto');
const auth = require('../helpers/auth');
const { config } = require('../config');
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const redirectUri = process.env.redirectUri;
const API_URL = 'https://apiv1.vio-v.com';
const scopes = ['read.self', 'read.group'];

async function fetchJson(url, options) {
   const response = await fetch(url, options);
   if (!response.ok) {
      throw new Error(`Vio API request failed (${response.status} ${response.statusText})`);
   }
   return response.json();
}

async function syncRoles(groupRoles, transaction) {
   if (!Array.isArray(groupRoles)) {
      throw new Error('Vio API returned an invalid group-ranks response');
   }

   for (const role of groupRoles) {
      if (role.RankID == null) continue;

      const [storedRole, created] = await db.models.Role.findOrCreate({
         where: { permissionLevel: Number(role.RankID) },
         defaults: {
            name: role.Name,
            permissionLevel: Number(role.RankID),
            isLeader: Boolean(role.Leader),
         },
         transaction,
      });

      if (!created && (storedRole.name !== role.Name || storedRole.isLeader !== Boolean(role.Leader))) {
         storedRole.name = role.Name;
         storedRole.isLeader = Boolean(role.Leader);
         await storedRole.save({ transaction });
      }
   }
}

exports.login = (req, res) => {
   const code_verifier = crypto.randomBytes(60).toString('base64url');
   const code_challenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');
   const code_challenge_method = 'S256';
   const client_id = CLIENT_ID;
   const state = crypto.randomBytes(32).toString('base64url');

   const authorizeUrlQuery = new URLSearchParams({
      code_challenge,
      code_challenge_method,
      client_id,
      redirect_uri: redirectUri,
      state,
      scope: scopes.join(' '),
      response_type: 'code',
   });
   const authorizeUrl = `${API_URL}/api/oauth2/authorize?${authorizeUrlQuery.toString()}`;
   req.session.code_verifier = code_verifier;
   req.session.oauth_state = state;
   res.redirect(authorizeUrl);
};

exports.loginSubmit = async (req, res) => {
   if (req.query.error) {
      console.error(`Vio OAuth authorization failed: ${req.query.error}`);
      await req.flash('error', 'Die Anmeldung bei Vio wurde abgebrochen oder abgelehnt.');
      return res.redirect('/');
   }

   const accessCode = req.query.code;
   const codeVerifier = req.session.code_verifier;
   const expectedState = req.session.oauth_state;
   delete req.session.code_verifier;
   delete req.session.oauth_state;

   if (!accessCode || !codeVerifier || !expectedState || req.query.state !== expectedState) {
      console.error('Vio OAuth callback is missing its code, PKCE verifier, or valid state.');
      await req.flash('error', 'Die Anmeldung bei Vio ist fehlgeschlagen. Bitte versuche es erneut.');
      return res.redirect('/');
   }

   try {
      const tokenRequest = new URLSearchParams({
         client_id: CLIENT_ID,
         code_verifier: codeVerifier,
         grant_type: 'authorization_code',
         redirect_uri: redirectUri,
         code: accessCode,
      });

      if (CLIENT_SECRET) tokenRequest.append('client_secret', CLIENT_SECRET);

      const tokenData = await fetchJson(`${API_URL}/api/oauth2/token`, {
         method: 'POST',
         body: tokenRequest.toString(),
         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const { access_token: accessToken, refresh_token: refreshToken, token_type: tokenType = 'Bearer' } = tokenData;
      if (!accessToken) throw new Error('Vio OAuth response did not contain an access token');

      const authorization = { Authorization: `${tokenType} ${accessToken}` };
      const playerData = await fetchJson(`${API_URL}/api/v3/self`, { headers: authorization });
      const isAdmin = config.adminCharId && String(playerData.ID) === String(config.adminCharId);
      const [groupResult, membersResult] = await Promise.allSettled([
         fetchJson(`${API_URL}/api/v3/group`, { headers: authorization }),
         fetchJson(`${API_URL}/api/v3/group/members`, { headers: authorization }),
      ]);

      if (!isAdmin && (groupResult.status === 'rejected' || membersResult.status === 'rejected')) {
         throw groupResult.status === 'rejected' ? groupResult.reason : membersResult.reason;
      }
      if (isAdmin && (groupResult.status === 'rejected' || membersResult.status === 'rejected')) {
         console.warn('Admin Vio login continuing without complete group data.');
      }

      const rawGroupData = groupResult.status === 'fulfilled' ? groupResult.value : null;
      const groupMemberData = membersResult.status === 'fulfilled' ? membersResult.value : [];
      const groupData = Array.isArray(rawGroupData)
         ? rawGroupData.find((group) => String(group.ID) === String(config.groupId))
         : rawGroupData;
      const isConfiguredGroup = groupData && String(groupData.ID) === String(config.groupId);

      if (!isConfiguredGroup && !isAdmin) {
         const existingUser = await db.models.User.findOne({ where: { charId: playerData.ID } });
         if (existingUser) {
            existingUser.roleId = null;
            existingUser.vio_access_token = null;
            existingUser.vio_refresh_token = null;
            await existingUser.save();
         }
         await req.flash('error', 'Du bist nicht Mitglied der Fraktion!');
         return res.redirect('/');
      }

      if (!Array.isArray(groupMemberData) && !isAdmin) {
         throw new Error('Vio API returned an invalid group-members response');
      }
      const myGroupData = Array.isArray(groupMemberData) ? groupMemberData.find((member) => String(member.CharacterID) === String(playerData.ID)) : null;
      if ((!myGroupData || myGroupData.Rank == null) && !isAdmin) {
         const existingUser = await db.models.User.findOne({ where: { charId: playerData.ID } });
         if (existingUser) {
            existingUser.roleId = null;
            existingUser.vio_access_token = null;
            existingUser.vio_refresh_token = null;
            await existingUser.save();
         }
         await req.flash('error', 'Du bist nicht Mitglied der Fraktion!');
         return res.redirect('/');
      }

      let rawRoles = [];
      if (isConfiguredGroup) {
         try {
            rawRoles = await fetchJson(`${API_URL}/api/v3/group/ranks`, { headers: authorization });
         } catch (error) {
            if (!isAdmin) throw error;
            console.warn(`Admin Vio login continuing without rank synchronization: ${error.message}`);
         }
      }

      const loginUser = await db.transaction(async (transaction) => {
         await syncRoles(rawRoles, transaction);

         const role = myGroupData && myGroupData.Rank != null
            ? await db.models.Role.findOne({
                 where: { permissionLevel: Number(myGroupData.Rank) },
                 transaction,
              })
            : null;
         if (myGroupData && myGroupData.Rank != null && !role) {
            throw new Error(`No synchronized Vio role found for rank ${myGroupData.Rank}`);
         }

         const [user, created] = await db.models.User.findOrCreate({
            where: { charId: playerData.ID },
            defaults: {
               name: playerData.Name,
               charId: playerData.ID,
               roleId: role ? role.id : null,
               vio_access_token: accessToken,
               vio_refresh_token: refreshToken || null,
            },
            transaction,
         });

         if (!created) {
            user.name = playerData.Name;
            user.roleId = role ? role.id : null;
            user.vio_access_token = accessToken;
            if (refreshToken) user.vio_refresh_token = refreshToken;
            await user.save({ transaction });
         }

         return user;
      });

      const gwData = await db.models.GWData.findByPk(1);
      if (gwData && gwData.invalidToken) {
         gwData.invalidToken = false;
         await gwData.save();
      }

      auth.setUser(req.session.id, loginUser.id);
      const returnTo = req.session.returnTo || '/';
      delete req.session.returnTo;
      return res.redirect(returnTo);
   } catch (error) {
      console.error(`Vio login failed: ${error.message}`);
      await req.flash('error', 'Die Anmeldung bei Vio ist fehlgeschlagen. Bitte versuche es erneut.');
      return res.redirect('/');
   }
};

exports.logout = (req, res) => {
   auth.removeUser(req.session.id);
   res.redirect('/login');
};
