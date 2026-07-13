import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, codeBlock,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { execSync } from 'child_process';

export default class OwnerCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('owner')
    .setDescription('👑 Owner Commands')
    .addSubcommand(s => s.setName('eval').setDescription('Chạy code JavaScript').addStringOption(o => o.setName('code').setDescription('Code').setRequired(true)))
    .addSubcommand(s => s.setName('reload').setDescription('Reload module').addStringOption(o => o.setName('module').setDescription('Tên module').setRequired(true)))
    .addSubcommand(s => s.setName('stats').setDescription('Bot statistics'))
    .addSubcommand(s => s.setName('broadcast').setDescription('Gửi tin nhắn tới tất cả server').addStringOption(o => o.setName('message').setDescription('Nội dung').setRequired(true)))
    .addSubcommand(s => s.setName('maintenance').setDescription('Bật/Tắt maintenance mode').addBooleanOption(o => o.setName('enabled').setDescription('Bật?').setRequired(true)));

  ownerOnly = true;
  cooldown = 0;

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    if (!kernel.isOwner(interaction.user.id)) {
      return void interaction.reply({ content: '❌ Lệnh này chỉ dành cho owner bot.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'eval') {
      await interaction.deferReply({ ephemeral: true });
      const code = interaction.options.getString('code', true);
      try {
        let result = eval(code);
        if (result instanceof Promise) result = await result;
        const output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('✅ Eval').setColor(0x2ecc71).addFields({ name: 'Input', value: codeBlock('js', code.slice(0, 500)) }, { name: 'Output', value: codeBlock(output.slice(0, 500)) })] });
      } catch (error: any) {
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('❌ Eval Error').setColor(0xe74c3c).addFields({ name: 'Error', value: codeBlock(String(error).slice(0, 1000)) })] });
      }
    } else if (sub === 'reload') {
      await interaction.deferReply({ ephemeral: true });
      const moduleName = interaction.options.getString('module', true);
      const success = await kernel.loader.reloadModule(moduleName);
      await interaction.editReply(success ? `✅ Module **${moduleName}** đã reload.` : `❌ Không thể reload **${moduleName}**.`);
    } else if (sub === 'stats') {
      const mem = process.memoryUsage();
      const embed = new EmbedBuilder()
        .setTitle('📊 Bot Statistics')
        .setColor(0x5865f2)
        .addFields(
          { name: '🤖 Guilds', value: `${kernel.client.guilds.cache.size}`, inline: true },
          { name: '👥 Users', value: `${kernel.client.users.cache.size}`, inline: true },
          { name: '📦 Modules', value: `${kernel.client.modules.size}`, inline: true },
          { name: '⚡ Commands', value: `${kernel.client.commands.size}`, inline: true },
          { name: '🕒 Uptime', value: `${Math.floor(kernel.uptime / 3600000)}h ${Math.floor(kernel.uptime % 3600000 / 60000)}m`, inline: true },
          { name: '💾 Memory', value: `${Math.floor(mem.heapUsed / 1024 / 1024)}MB / ${Math.floor(mem.heapTotal / 1024 / 1024)}MB`, inline: true },
          { name: '🌐 Node.js', value: process.version, inline: true },
          { name: '📚 discord.js', value: 'v14', inline: true },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'broadcast') {
      await interaction.deferReply({ ephemeral: true });
      const message = interaction.options.getString('message', true);
      let sent = 0;
      for (const guild of kernel.client.guilds.cache.values()) {
        try {
          const channel = guild.systemChannel ?? guild.channels.cache.find(c => c.isTextBased() && (c as any).permissionsFor?.(guild.members.me!)?.has('SendMessages'));
          if (channel?.isTextBased()) {
            await (channel as any).send({ embeds: [new EmbedBuilder().setTitle('📢 Thông báo từ Bot').setDescription(message).setColor(0x5865f2)] });
            sent++;
          }
        } catch {}
      }
      await interaction.editReply(`✅ Đã gửi broadcast tới **${sent}/${kernel.client.guilds.cache.size}** server.`);
    } else if (sub === 'maintenance') {
      const enabled = interaction.options.getBoolean('enabled', true);
      kernel.cache.set('maintenance_mode', enabled, 0);
      kernel.client.user?.setPresence({
        activities: [{ name: enabled ? '🔧 Maintenance Mode' : '⚡ Enterprise Bot | /help', type: 0 }],
        status: enabled ? 'dnd' : 'online',
      });
      await interaction.reply({ content: `✅ Maintenance mode: **${enabled ? 'BẬT' : 'TẮT'}**`, ephemeral: true });
    }
  }
}
