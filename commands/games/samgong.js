import { gameSamgongSolo } from '../../lib/game.js';

export default {
	name: 'samgong',
	aliases: ['kartu'],

	async execute(ctx) {
		const { m, voxel, db } = ctx;
		return gameSamgongSolo(voxel, m, db);
	},
};
