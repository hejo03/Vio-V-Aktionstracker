const db = require('../models').sequelize;
const { Op } = require('sequelize');
const Utility = require('../helpers/utility');
const fetch = require('node-fetch');
const crypto = require('crypto');
const auth = require('../helpers/auth');
const { config } = require('../config');
const { getData } = require('../helpers/vioHandler');
const moment = require('moment');
moment.locale('de');
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const redirectUri = process.env.redirectUri;
const API_URL = 'https://apiv1.vio-v.com';
const scopes = ['read.self', 'read.group'];

exports.login = (req, res) => {
   const code_verifier = crypto.randomBytes(60).toString('base64url');
   const code_challenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');
   const code_challenge_method = 'S256';
   const client_id = CLIENT_ID;
   const state = crypto.randomBytes(10).toString('base64url');

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
   res.redirect(authorizeUrl);
};

exports.loginSubmit = async (req, res) => {
   const accessCode = req.query.code;
   if (!accessCode) {
      await req.flash('error', 'Es gab einen Fehler mit Vio.');
      return res.redirect('/');
   }

   const data = new URLSearchParams();
   data.append('client_id', CLIENT_ID);
   data.append('client_secret', CLIENT_SECRET);
   data.append('code_verifier', req.session.code_verifier);
   data.append('grant_type', 'authorization_code');
   data.append('redirect_uri', redirectUri);
   data.append('code', accessCode);

   const token_data = await fetch(`${API_URL}/api/oauth2/token`, {
      method: 'POST',
      body: data.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
   });
   if (token_data.status !== 200) {
      return res.redirect('/');
   }

   const { access_token, token_type, refresh_token } = await token_data.json();
   // console.log({ token_data: await token_data.json() });

   const self_data = await fetch(`${API_URL}/api/v3/self`, {
      method: 'GET',
      headers: {
         authorization: `${token_type} ${access_token}`,
      },
   });
   const group_data = await fetch(`${API_URL}/api/v3/group`, {
      method: 'GET',
      headers: {
         authorization: `${token_type} ${access_token}`,
      },
   });
   const group_members = await fetch(`${API_URL}/api/v3/group/members`, {
      method: 'GET',
      headers: {
         authorization: `${token_type} ${access_token}`,
      },
   });

   const playerData = await self_data.json();
   const groupData = await group_data.json();
   const groupMemberData = await group_members.json();

   const myGroupData = groupMemberData.find((f) => f.CharacterID == playerData.ID);

   const findRole = await db.models.Role.findOne({ where: { permissionLevel: myGroupData.Rank } });
   if (!findRole) {
      console.log('No role found for ' + playerData.name);
      await req.flash('error', 'Du bist nicht Mitglied der Fraktion!');
      return res.redirect('/');
   }

   let loginUser = await db.models.User.findOne({
      where: {
         charId: playerData.ID,
      },
   });

   if (config.groupId == groupData[0].ID) {
      if (!loginUser) {
         loginUser = await db.models.User.create({
            name: playerData.Name,
            charId: playerData.ID,
            roleId: findRole.id,
            vio_refresh_token: access_token,
            vio_access_token: refresh_token,
         });
      }
   } else {
      if (loginUser) {
         loginUser.roleId = null;
         loginUser.save();
      }
      await req.flash('error', 'Du bist nicht Mitglied der Fraktion!');
      return res.redirect('/');
   }

   if (loginUser.name !== playerData.Name) loginUser.name = playerData.Name;
   loginUser.charId = playerData.ID;
   loginUser.roleId = findRole.id;
   loginUser.vio_access_token = access_token;
   loginUser.vio_refresh_token = refresh_token;
   loginUser.save();

   auth.setUser(req.session.id, loginUser.id);
   res.redirect(req.session.returnTo || '/');
   delete req.session.returnTo;
};

exports.logout = (req, res) => {
   auth.removeUser(req.session.id);
   res.redirect('/login');
};
