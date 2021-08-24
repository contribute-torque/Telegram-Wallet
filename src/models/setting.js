const Model = require('./base');

class Setting extends Model
{

	get fields() {
		return [
		"tip",
		"tip_submit"
		];
	} 
	
	get className() {
		return 'user';
	}


	updateField(id, field, value, options) {
		return this.Query(options).updateField(id, field, value);
	}
}


module.exports = Setting;