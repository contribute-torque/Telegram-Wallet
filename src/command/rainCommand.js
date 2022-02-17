/**
 * A Telegram Command. Transfer sends coin to username.
 * To return current wallets address do /tip <username>
 * @module Commands/tip
 */
const Command = require('../base/command');
const STATUS = require('../status');
const Telegraf = require('telegraf');

class TransferCommand extends Command {
	enabled = true;

	get name() {
        return "rain";
    }
	
	get description() {
		return "Send coins to latest active users. To set default rain value go to /set rain <amount>";
	}

	auth(ctx) {
		return ctx.appRequest.is.group;
	}


	async run(ctx) {
		if(ctx.test)  return;
		
		const Wallet = this.loadModel("Wallet");
		const User = this.loadModel("User");
		const Member = this.loadModel("Member");
		const Meta = this.loadModel("Meta");
		const Setting = this.loadModel("Setting");

		const sender = await User.findById(ctx.from.id);

		if(!sender) {
			ctx.reply(`Please create an account before sending an raindrops`);
			return ctx.telegram.sendMessage(ctx.from.id,`User not avaliable please /create`);
		}
		
		if(!sender.wallet) {
			
			sender.wallet = Wallet.findByUserId(sender.user_id);
			
			if(!sender.wallet) {
				ctx.reply(`No wallet avaliable`);
				return ctx.telegram.sendMessage(ctx.from.id,`No wallet avaliable`);
			}
		}

		let wallet =await Wallet.syncBalance(ctx, sender.wallet, this.Coin);
		if(!wallet) {
			return ctx.telegram.sendMessage(ctx.from.id,`Wallet not avaliable please /create`);
		}
		let rain_value = sender.rain;
		if(!rain_value) {
			rain_value = await Settings.findByFieldAndUserId('rain', ctx.from.id);
		}
		
		const amount = Setting.validateValue('rain', rain_value);

		const members = await Member.findByLast10(ctx.chat.id);
		
		const destinations = [];
		let userNames = [];

		if(members.length <= 0) {
			return ctx.reply("No members avaliable");
		}

		let more = 0;
		let sentMemberIds = [];
		for(let i =0;i< members.length;i++) {

			const user_id = members[i];
			if(parseInt(user_id) === parseInt(sender.user_id)) continue;

			const user = await User.findById(user_id);

			if(!user || !user.wallet) {
				continue;
			}

			userNames.push("@"+user.username);
			sentMemberIds.push(user_id);
			destinations.push({
				address:user.wallet.address,
				amount
			});
			if(userNames.length === 10) {
				break;
			}
		}

		if(destinations.length <= 0) {
			return ctx.reply("No member with an account");
		}
		const estimate = amount * destinations.length * 1.02; //We assume the fee is 2%
		if(estimate > parseInt(wallet.unlock)) {
			ctx.reply(`Insufficient fund to ${destinations.length} total required ${this.Coin.format(send)}`);
			return ctx.telegram.sendMessage(ctx.from.id,`Insufficient fund to ${destinations.length} total required ${this.Coin.format(estimate)}`);
		}

		if(sender.rain_submit === 'enable') {
			const trx = await this.Coin.transferMany(ctx.from.id, wallet.wallet_id, destinations, false);
			if(!trx) {
				return ctx.reply('Unable to connect with rpc. Please try again later');
			}
			if('error' in trx) {
				return ctx.reply("RPC Error: " + trx.error);
			}
			const trx_fee = trx.fee_list.reduce((a, b) => a + b, 0);
			const trx_amount = trx.amount_list.reduce((a, b) => a + b, 0);
			const tx_hash = trx.tx_hash_list.join("\n* ");
			const balance = parseInt(wallet.balance) - parseInt(trx_amount) - parseInt(trx_fee);
	
			ctx.telegram.sendMessage(ctx.from.id,`
** Transaction Details **

From: 
@${sender.username}

To: 
${userNames.join("\n*")}

Amount : ${this.Coin.format(trx_amount)}
Fee : ${this.Coin.format(trx_fee)}
Trx Hash: 
* ${tx_hash}
Current Balance : ${this.Coin.format(balance)}
			`);

			for(let smi of sentMemberIds) {
				ctx.telegram.sendMessage(smi,`
** Transaction Details **

From: 
@${sender.username}

To: 
${userNames.join("\n*")}

Amount : ${this.Coin.format(trx_amount)}
Fee : ${this.Coin.format(trx_fee)}
Trx Hashes (${trx.tx_key_list.length} Transactions): 
* ${tx_hash}
			`);

			}
			const total = this.Coin.format(trx_amount + trx_fee);
			ctx.reply("Airdrops to last " + userNames.length + " active members total of " + total + "\n" + userNames.join("\n"));
		} else {


			const trx = await this.Coin.transferMany(ctx.from.id, wallet.wallet_id, destinations, true);
			if(!trx) {
				return ctx.reply('Unable to connect with rpc. Please try again later');
			}
			if('error' in trx) {
				return ctx.reply("RPC Error: " + trx.error);
			}
			const trx_fee = trx.fee_list.reduce((a, b) => a + b, 0);
			const trx_amount = trx.amount_list.reduce((a, b) => a + b, 0);
			const tx_hash = trx.tx_hash_list.join("\n * ");
			const balance = parseInt(wallet.balance) - parseInt(trx_amount) - parseInt(trx_fee);
			const uuid = await Meta.getId(ctx.from.id, trx.tx_metadata_list.join(':'));

			return ctx.telegram.sendMessage(ctx.from.id,`
** Transaction Details **

From: 
@${sender.username}

To: 
${userNames.join("\n")}
				
Amount : ${this.Coin.format(trx_amount)}
Fee : ${this.Coin.format(trx_fee)}
Trx Meta ID: ${uuid}
Trx Expiry: ${global.config.rpc.metaTTL} seconds
Current Unlock Balance : ${this.Coin.format(wallet.balance)}
Number of transactions : ${trx.tx_hash_list.length}
To proceed with transaction run
/submit ${uuid} 
			`);
		}
	}
}
module.exports = TransferCommand;
