/**
 * A Telegram Command. Balance returns wallet balance.
 * @module Commands/balance
 */

const Command = require('../base/command');
const utils = require('../utils');
const TimeAgo = require('javascript-time-ago');
const timeAgo = new TimeAgo('en-US')
const logSystem = "command/balance";
const { Markup } = require('telegraf');

class BalanceCommand extends Command {
	get name () {
		return "balance";
	}

	get description() {
        return "Returns all wallet(s) balance";
    }

	auth(ctx) {
		return !ctx.appRequest.is.group;
	}
    
	async run(ctx){
		if(ctx.test)  return;
		
		const Wallet = this.loadModel("Wallet");

		let old_wallet = await Wallet.findByUserId(ctx.from.id);
		let output = "<b><u>Wallet Information</u></b>\n";

		if(old_wallet) {
			
			let wallet;

			const sync_wallet = await Wallet.syncBalance(ctx.from.id, old_wallet, this.Coin);
			if(sync_wallet && 'error' in sync_wallet) {
				wallet = old_wallet;
			} else {
				wallet = sync_wallet;
			}
			output +=`Coin ID: ${wallet.coin_id}\n`;
			output +=`Balance: ${utils.formatNumber(this.Coin.format(wallet.balance || 0))}\n`;
			output +=`Unlocked Balance: ${utils.formatNumber(this.Coin.format(wallet.unlock || 0))}\n`;
			output +=`Last Sync: ${timeAgo.format(parseInt(wallet.updated || 0),'round')}\n`;
			output +=`Last Height: ${utils.formatNumber(wallet.height || 0)}\n`;

			if(wallet.pending > 0) {
				output +=`Confirmations Remaining: ${wallet.pending}\n`;	
			}
			// await Wallet.update(wallet);
		} else {
			output +='No wallet avaliable';
		}

		ctx.appResponse.reply(output);

	}
}

module.exports = BalanceCommand;
