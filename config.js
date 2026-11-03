require('dotenv').config();
exports.config = {
   gangName: process.env.GANG_NAME || 'GANG_NAME',
   version: '1.3',
   scopes: ['identify'],
   groupId: process.env.VIO_GROUP_ID || 'YOUR_VIO_GROUP_ID',
   adminCharId: process.env.ADMIN_CHAR_ID || null,
   discordBotToken: process.env.DISCORD_BOT_TOKEN || null,
   defaultAttackMessage: (process.env.GROUP_TYPE || 'gang').toLowerCase() === 'gang' ? 'Das Gebiet wird gerade angegriffen!' : 'Die Fabrik wird gerade angegriffen!',
   // 'gang' tracks gangwar territories (/group/areas)
   // 'squad' tracks factories (/group/own_factories)
   groupType: (process.env.GROUP_TYPE || 'gang').toLowerCase(),
};
