import { gameCasinoSolo } from '../../lib/game.js';

export default {
	name: 'casino',
	aliases: [],

	async execute(ctx) {
		const { m, voxel, db, prefix } = ctx;
		return gameCasinoSolo(voxel, m, prefix, db);
	},
};
