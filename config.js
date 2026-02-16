require('dotenv').config();
exports.config = {
   gangName: process.env.GANG_NAME || 'GANG_NAME',
   version: '1.0',
   scopes: ['identify'],
   logHook: process.env.DISCORD_WEBHOOK || 'YOUR_DISCORD_WEBHOOK',
   groupId: process.env.VIO_GROUP_ID || 'YOUR_VIO_GROUP_ID',
   notificationHook: process.env.NOTIFY_DISCORD_WEBHOOK || 'YOUR_NOTIFY_DISCORD_WEBHOOK',
   dcMemberRole: process.env.DC_PING_ROLE || 'YOUR_DC_PING_ROLE',
};
