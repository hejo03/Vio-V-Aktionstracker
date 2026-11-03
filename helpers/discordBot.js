const { ActivityType, ChannelType, Client, EmbedBuilder, GatewayIntentBits, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { Op } = require('sequelize');
const { config } = require('../config');
const db = require('../models').sequelize;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const CHANNEL_FIELDS = {
   logs: 'logChannelId',
   alerts: 'notificationChannelId',
   player_limit: 'playerLimitChannelId',
};

function getChannelCommand() {
   return new SlashCommandBuilder()
      .setName('tracker')
      .setDescription('Konfiguriert die Aktionstracker-Benachrichtigungen')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((subcommand) =>
         subcommand
            .setName('channel')
            .setDescription('Wählt den Zielkanal für Benachrichtigungen aus')
            .addStringOption((option) =>
               option
                  .setName('bereich')
                  .setDescription('Welche Nachrichten sollen hier erscheinen?')
                  .setRequired(true)
                  .addChoices(
                     { name: 'Betriebslogs', value: 'logs' },
                     { name: 'Angriffe und Gruppenalarme', value: 'alerts' },
                     { name: 'Spielergrenze', value: 'player_limit' }
                  )
            )
            .addChannelOption((option) =>
               option
                  .setName('kanal')
                  .setDescription('Discord-Textkanal für diese Nachrichten')
                  .setRequired(true)
                  .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            )
      )
      .addSubcommand((subcommand) =>
         subcommand
            .setName('message')
            .setDescription('Legt eine eigene Nachricht für Angriffsmeldungen fest')
            .addStringOption((option) => option.setName('text').setDescription('Leer lassen, um die Standardnachricht zu verwenden').setMaxLength(1000))
      )
      .addSubcommand((subcommand) =>
         subcommand
            .setName('role')
            .setDescription('Legt die optionale Ping-Rolle fest (ohne Rolle wird sie entfernt)')
            .addRoleOption((option) => option.setName('rolle').setDescription('Rolle, die bei Alarmen erwähnt wird'))
      );
}

async function getGuildConfig(guildId) {
   const [guildConfig] = await db.models.DiscordGuildConfig.findOrCreate({
      where: { guildId },
      defaults: { guildId },
   });
   return guildConfig;
}

async function handleInteraction(interaction) {
   if (interaction.isChatInputCommand() && interaction.commandName === 'stats') {
      await interaction.deferReply({ ephemeral: true });
      const { getPlayerStats } = require('./playerStats');
      const stats = await getPlayerStats();
      if (!stats) {
         await interaction.editReply('Die aktuellen Spielerzahlen sind momentan nicht verfügbar.');
         return;
      }

      const embed = new EmbedBuilder()
         .setTitle('Vio-V Spielerstatistik')
         .setDescription(`Aktuell sind **${stats.onlinePlayerCount} Spieler** online.\nDie Spielergrenze liegt bei **${stats.playerThreshold} Spielern**.`)
         .setColor(0x2b2d31)
         .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
   }

   if (!interaction.isChatInputCommand() || interaction.commandName !== 'tracker') return;
   if (!interaction.guildId) {
      await interaction.reply({ content: 'Dieser Befehl kann nur auf einem Discord-Server verwendet werden.', ephemeral: true });
      return;
   }

   const guildConfig = await getGuildConfig(interaction.guildId);
   const subcommand = interaction.options.getSubcommand();
   if (subcommand === 'channel') {
      const area = interaction.options.getString('bereich', true);
      const channel = interaction.options.getChannel('kanal', true);
      const field = CHANNEL_FIELDS[area];
      await guildConfig.update({ [field]: channel.id });
      await interaction.reply({ content: `Der Kanal für **${area.replace('_', ' ')}** ist jetzt ${channel}.`, ephemeral: true });
      return;
   }

   if (subcommand === 'message') {
      const message = interaction.options.getString('text');
      await guildConfig.update({ attackMessage: message?.trim() || null });
      await interaction.reply({
         content: message?.trim() ? 'Die eigene Angriffsnachricht wurde gespeichert.' : `Die Standardnachricht wird verwendet: „${config.defaultAttackMessage}“`,
         ephemeral: true,
      });
      return;
   }

   if (subcommand === 'role') {
      const role = interaction.options.getRole('rolle');
      await guildConfig.update({ notificationRoleId: role?.id || null });
      await interaction.reply({
         content: role ? `${role} wird bei Alarmen erwähnt.` : 'Die Rollen-Erwähnung wurde entfernt.',
         allowedMentions: { roles: role ? [role.id] : [] },
         ephemeral: true,
      });
   }
}

client.on('interactionCreate', (interaction) => {
   handleInteraction(interaction).catch(async (error) => {
      console.error('Discord command failed:', error);
      if (interaction.isRepliable()) {
         const response = { content: 'Der Befehl konnte nicht ausgeführt werden. Bitte prüfe die Bot-Logs.', ephemeral: true };
         if (interaction.replied || interaction.deferred) {
            await interaction.followUp(response).catch((replyError) => console.error('Could not report Discord command failure:', replyError));
         } else {
            await interaction.reply(response).catch((replyError) => console.error('Could not report Discord command failure:', replyError));
         }
      }
   });
});

client.once('clientReady', async () => {
   try {
      const commands = [
         getChannelCommand(),
         new SlashCommandBuilder().setName('stats').setDescription('Zeigt die aktuelle Spielerzahl und Spielergrenze an.'),
      ];
      await client.application.commands.set(commands);
      client.user.setPresence({
         activities: [{ name: 'Spielerzahlen werden geladen', type: ActivityType.Watching }],
         status: 'online',
      });
      const { getPlayerStats } = require('./playerStats');
      const stats = await getPlayerStats();
      if (stats) updatePlayerActivity(stats);
      console.log(`✅ Discord-Bot angemeldet als ${client.user.tag}`);
   } catch (error) {
      console.error('Discord commands or presence could not be initialized:', error);
   }
});

async function startDiscordBot() {
   if (!config.discordBotToken) {
      console.warn('DISCORD_BOT_TOKEN is not configured; Discord bot notifications are disabled.');
      return;
   }
   await client.login(config.discordBotToken);
}

async function stopDiscordBot() {
   if (client.isReady()) client.destroy();
}

async function sendToConfiguredGuilds(channelField, createPayload) {
   const guildConfigs = await db.models.DiscordGuildConfig.findAll({
      where: { [channelField]: { [Op.ne]: null } },
   });

   if (guildConfigs.length === 0) return null;
   if (!client.isReady()) {
      console.error('Discord message could not be sent: bot is not connected.');
      return false;
   }

   const results = await Promise.all(
      guildConfigs.map(async (guildConfig) => {
         try {
            const channel = await client.channels.fetch(guildConfig[channelField]);
            if (!channel || !channel.isTextBased() || !channel.send) {
               throw new Error(`Discord channel ${guildConfig[channelField]} is unavailable or not text-based`);
            }
            await channel.send(createPayload(guildConfig));
            return true;
         } catch (error) {
            console.error(`Discord message could not be sent to guild ${guildConfig.guildId}:`, error);
            return false;
         }
      })
   );
   return results.some(Boolean);
}

function updatePlayerActivity(stats) {
   if (!client.isReady() || !stats) return;
   client.user.setActivity(`${stats.onlinePlayerCount}/${stats.playerThreshold} Spieler online`, { type: ActivityType.Watching });
}

module.exports = { startDiscordBot, stopDiscordBot, sendToConfiguredGuilds, updatePlayerActivity };
