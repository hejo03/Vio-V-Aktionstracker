require('dotenv').config();
exports.config = {
   gangName: process.env.GANG_NAME || 'GANG_NAME',
   version: '1.2',
   scopes: ['identify'],
   logHook: process.env.DISCORD_WEBHOOK || 'YOUR_DISCORD_WEBHOOK',
   groupId: process.env.VIO_GROUP_ID || 'YOUR_VIO_GROUP_ID',
   adminCharId: process.env.ADMIN_CHAR_ID || null,
   notificationHook: process.env.NOTIFY_DISCORD_WEBHOOK || 'YOUR_NOTIFY_DISCORD_WEBHOOK',
   playerLimitNotificationHook: process.env.PLAYER_LIMIT_DISCORD_WEBHOOK || null,
   dcMemberRole: process.env.DC_PING_ROLE || 'YOUR_DC_PING_ROLE',
   CUSTOM_ATTACK_MESSAGE:
      process.env.CUSTOM_ATTACK_MESSAGE ||
      ((process.env.GROUP_TYPE || 'gang').toLowerCase() === 'gang' ? 'Das Gebiet wird gerade angegriffen!' : 'Die Fabrik wird gerade angegriffen!'),
   // 'gang' tracks gangwar territories (/group/areas)
   // 'squad' tracks factories (/group/own_factories)
   groupType: (process.env.GROUP_TYPE || 'gang').toLowerCase(),
};
