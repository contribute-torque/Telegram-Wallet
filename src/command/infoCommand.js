'use strict'
/**
 * A Telegram Command. Info basically returns wallet and settings
 * information. To return execute do /info
 * @module Commands/height
 */
const Command = require('../base/command');
const utils = require('../utils');
const TimeAgo = require('javascript-time-ago');
const timeAgo = new TimeAgo('en-US')
class InfoCommand extends Command {
	get name() {
		return "info";
	}

	get description() {
		return "Returns information about your profile and wallets";
	}

	auth(ctx) {
		return !ctx.appRequest.is.group;
	}

	enabled = true;

	async run(ctx, callback) {
		if (ctx.test) return;

		const User = this.loadModel("user");
		const Wallet = this.loadModel("Wallet");
		const Settings = this.loadModel("Setting");


		let result = await User.findById(ctx.from.id);
		
		if (!result) {
			return ctx.reply("User and wallet not avaliable please /create");
		}

		let totalBalance = 0;
		let output = "";
		output += '** User Information **\n';
		for (let field of User.fields) {
			if (!!~['wallet_id', 'wallet', 'status', 'user_id', 'coin_id'].indexOf(field)) {
				continue;
			}
			output += `[${field}] : ${result[field]}\n`;
		}

		output += '\n** User Settings **\n';
		for (const i in Settings.fields) {
			const field = Settings.fields[i];
			
			let out = Settings.validateValue(field,result[field]);
			switch (field) {
				case 'tip':
				case 'rain':
					out = this.Coin.format(out);
					break;
				case 'tip_submit':
				case 'rain_submit':
				default:
					if(out === false) {
						out = 'disable';
					}
					break;
			}
			output += `[${field}] : ${out}\n`;
		}

		output += '\n** Wallet Information **\n';

		const wallet = result.wallet ? result.wallet : await Wallet.findByUserId(ctx.from.id);

		if (wallet) {
			output += `Address : ${wallet.address}\n`;
			output += `Balance : ${utils.formatNumber(this.Coin.format(wallet.balance || 0))}\n`;
			output += `Unlock : ${utils.formatNumber(this.Coin.format(wallet.unlock || 0))}\n`;
			output += `Height : ${utils.formatNumber(wallet.height || 0)}\n`;
			output += `Last Sync: ${timeAgo.format(parseInt(wallet.updated || 0),'round')}\n`;
		} else {
			output += 'No wallet avaliable\n';
		}

		ctx.reply(output);

	}
}

module.exports = InfoCommand;
