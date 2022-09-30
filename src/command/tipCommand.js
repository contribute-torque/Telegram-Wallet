'use strict';
/**
 * A Telegram Command. Transfer sends coin to username.
 * To return current wallets address do /tip <username>
 * @module Commands/tip
 */
const Command = require('../base/command');

class TransferCommand extends Command {
	get name () {
		return 'tip';
	}

	get description () {
		return 'Tip coin to another user. Run /tip for more information';
	}

	get full_description() {
		return `Transfer coin to another user. 
To setup default tipping value go to /set coin tip amount.
Usages : /tip coin username custom_amount(optional)
You can send a non default value by /tip coin username custom_amount (eg : /tip xla username 10)
For multiple users /tip coin username1 username2 username3 username4 custom_amount`
	}

	auth (ctx) {
		return true;
	}

	async run (ctx) {
		if (ctx.test) return;


		const Wallet = this.loadModel('Wallet');
		const User = this.loadModel('User');
		const Meta = this.loadModel('Meta');
		const Setting = this.loadModel('Setting');
		const sender = await User.findById(ctx.from.id);

		if (!sender) {
			return ctx.appResponse.reply('User account not avaliable. Please create a wallet https://t.me/' + global.config.bot.username);
		}

		const currentMeta = await Meta.getByUserId(ctx.from.id);

		if(currentMeta) {
			return ctx.appResponse.sendMessage(ctx.from.id, 'Confirmations still pending. Unable to create new request');
		}

		if (ctx.appRequest.args.length < 1) {
			return ctx.appResponse.reply(`Missing coin argument\n${this.full_description}`);
		}
		let coin = (''+ctx.appRequest.args[0]).trim().toLowerCase();
		if(!coin) {
			coin = 'xla';
		}
		if(!~global.config.coins.indexOf(coin)) {
			return ctx.appResponse.reply(`Invalid coin. Avaliable coins are ${global.config.coins.join(',')}`);
		}
		const coinObject = this.Coins.get(coin);

		const wallet = await Wallet.syncBalance(ctx.from.id, wallet, coinObject);
		if (wallet && 'error' in wallet) {
			return ctx.sendMessage(ctx.from.id, wallet.error);
		}
		const args = [].concat(ctx.appRequest.args);
		args.shift();//removing coin
		let tipAmount = args[ctx.appRequest.args.length - 1];
		if(isNaN(tipAmount)) {
			tipAmount = await Setting.findByFieldAndUserId('tip', ctx.from.id, coin);
		} else {
			args.pop();//removing amount
			tipAmount = coinObject.parse(tipAmount);
		}

		if (Setting.validateValue('tip', tipAmount, coin) !== tipAmount) {
			return ctx.appResponse.sendMessage(ctx.from.id, `Tip amount exceed min (${coinObject.format(global.coins[coin].settings.tip_min)}) or max (${coinObject.format(global.coins[coin].settings.tip_max)})`);
		}

		const estimate = coinObject.estimateFee(tipAmount);
		let unlock = 'unlock' in wallet ? wallet.unlock : wallet.balance;
		if('trading' in wallet) {
			unlock-= wallet.trading;
		}
		if (estimate > parseFloat(unlock)) {
			return ctx.appResponse.sendMessage(ctx.from.id, `Insufficient fund estimate require ${coinObject.format(estimate)}`);
		}
		const destinations = [];
		const userIds = [];
		const invalids = {
			user :[],
			wallet:[],
			fails:[]
		}
		for (const _uname of ctx.appRequest.args) {
			if(!_uname || !_uname.trim()) continue;
			let username = _uname.trim();
			if (username.startsWith('@')) {
				username = username.substr(1);
			}
			if (username === sender.username) continue;

			const user = await User.findByUsername(username);

			if (!user || !('user_id' in user)) {
				invalids.user.push(username);
				continue;
			}
			const rwallet = await Wallet.findByUserId(user.user_id,coin);
			if (!rwallet) {
				invalids.wallet.push(user.user_id);
				continue;	
			}

			if ('error' in rwallet) {
				invalids.wallet.push({username, error:rwallet.error});
				continue;	
			}

			userIds.push(user);
			destinations.push({
				amount: tipAmount,
				address: user.wallet.address
			});
		}
		if(destinations.length < 1) {
			return await ctx.appResponse.reply(`Invalid tip to no users with ${coin.toUpperCase()} wallet or linked`);	
		}
		const tip_submit = await Setting.findByFieldAndUserId('tip_submit', ctx.from.id);
		const confirms = tip_submit !== 'disable';
		const trx = await coinObject.transferMany(ctx.from.id, wallet.wallet_id, destinations, confirms);
		if (!trx) {
			return await ctx.appResponse.reply('No response from  RPC');
		}
		if ('error' in trx) {
			return await ctx.appResponse.reply('Error RPC: '+ trx.error);
		}

		if (confirms) {
			
			const uuid = await Meta.getId(ctx.from.id, trx.tx_metadata_list.join(':'));
			const ftrxAmount = trx.amount_list.reduce((a, b) => a + b, 0);
			const ftrxFee = trx.fee_list.reduce((a, b) => a + b, 0);

			await ctx.appResponse.sendMessage(ctx.from.id, `
<u>Transaction Details</u>

<b>From:</b> 
@${sender.username}

<b>To:</b> 
@${userIds.map(u => u.username).join('\n@')}

<b>Tip Amount :</b>  ${coinObject.format(ftrxAmount)}
<b>Fee :</b>  ${coinObject.format(ftrxFee)}
<b>Trx Meta ID :</b>  ${uuid}
<b>Trx Expiry :</b>  ${global.config.rpc.metaTTL} seconds
<b>Current Unlock Balance :</b>  ${coinObject.format(unlock)}
<b>Number of transactions :</b>  ${trx.tx_hash_list.length}
Press button below to confirm`,this.Helper.metaButton());
		} else {
			const trxAmount = trx.amount_list.reduce((a, b) => a + b, 0);
			const txHash = trx.tx_hash_list.join('\n * ');
			const trxFee = trx.fee_list.reduce((a, b) => a + b, 0);
			// const balance = parseInt(wallet.balance) - parseInt(trxAmount) - parseInt(trxFee);
			await ctx.appResponse.sendMessage(ctx.from.id, `
<u>Transaction Details</u>

From: 
@${sender.username}

To: 
@${userIds.map(u => u.username).join('\n@')}

<b>Tip Amount :</b>  ${coinObject.format(trxAmount)}
Fee : ${coinObject.format(trxFee)}
Current Unlock Balance : ${coinObject.format(unlock)}
Number of transactions : ${trx.tx_hash_list.length}
			`);
			const template = `
<u>Transaction Details</u>

From: 
@${sender.username}

To: 
@${userIds.map(u => u.username).join('\n@')}

Amount : ${coinObject.format(trxAmount)}
Fee : ${coinObject.format(trxFee)}
Number of transactions : ${trx.tx_hash_list.length}
Trx Hashes (${trx.amount_list.length} Transactions): 
* ${txHash}`;

			for (const u of userIds) await ctx.appResponse.sendMessage(u.user_id, template);
		}
		let msg = "";
		for(const [key,value] of Object.entries(invalids)) {
			switch(key){
				case 'user':
				msg+=`\n* User does is not linked ${value}`;
				break;
				case 'wallet':
				await ctx.appResponse.sendMessage(u.user_id, `Somebody tried to tip you but no ${coin} wallet found. Run /address to create one`);
				break;
				case 'fails':
				msg+=`\n* Trying to send to  ${value.username} fails. Error : ${value.error}`;
				break;

			}
		}
		if(msg) {
			await ctx.appResponse.sendMessage(ctx.from.id, `<u><b>Tip Error Log</b></u>\n${msg}`);
		}
	}
}

module.exports = TransferCommand;
