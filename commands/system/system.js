export default {
	name: 'system',
	aliases: ['react', 'tagme'],

	async execute(ctx) {
		const { command, m, voxel, args } = ctx;

		switch (command) {
			case 'react':
				return voxel.sendMessage(m.chat, { react: { text: args[0], key: m.quoted ? m.quoted.key : m.key } });
			case 'tagme':
				return m.reply(`@${m.sender.split('@')[0]}`, { mentions: [m.sender] });
			default:
				return null;
		}
	},
};
