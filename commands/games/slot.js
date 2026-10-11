import { gameSlot } from '../../lib/game.js';

export default {
	name: 'slot',
	aliases: [],

	async execute(ctx) {
		const { m, voxel, db } = ctx;
		return gameSlot(voxel, m, db);
	},
};
