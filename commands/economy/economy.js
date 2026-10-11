import { buy, daily, transfer } from '../../lib/game.js';

async function dailyCommand(ctx) {
	return daily(ctx.m, ctx.db);
}

async function transferCommand(ctx) {
	const { m, args, db, voxel, store } = ctx;
	return transfer(m, args, db, voxel, store);
}

async function buyCommand(ctx) {
	const { m, args, db } = ctx;
	return buy(m, args, db);
}

export default {
	name: 'economy',
	aliases: ['daily', 'claim', 'transfer', 'tf', 'buy'],

	async execute(ctx) {
		const { command } = ctx;
		switch (command) {
			case 'daily':
			case 'claim':
				return dailyCommand(ctx);
			case 'transfer':
			case 'tf':
				return transferCommand(ctx);
			case 'buy':
				return buyCommand(ctx);
			default:
				return null;
		}
	},
};
