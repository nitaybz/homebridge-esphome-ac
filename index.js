const ESPHome = require('./lib/esphome')
const PLUGIN_NAME = 'homebridge-esphome-ac'
const PLATFORM_NAME = 'ESPHomeAC'
module.exports = (api) => {
	api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, ESPHomeAC)
}

class ESPHomeAC {

	constructor(log, config, api) {
		this.api = api
		this.log = log

		this.accessories = []
		this.esphomeDevices = {}
		this.PLUGIN_NAME = PLUGIN_NAME
		this.PLATFORM_NAME = PLATFORM_NAME
		this.name = config.name || PLATFORM_NAME
		this.devices = config.devices || []
		this.debug = config.debug || false

		
		// define debug method to output debug logs when enabled in the config
		this.log.easyDebug = (...content) => {
			if (this.debug) {
				this.log(content.reduce((previous, current) => {
					return previous + ' ' + current
				}))
			} else
				this.log.debug(content.reduce((previous, current) => {
					return previous + ' ' + current
				}))
		}

		this.api.on('didFinishLaunching', ESPHome.init.bind(this))

	}

	configureAccessory(accessory) {
		this.log.easyDebug(`Found Cached Accessory: ${accessory.displayName} (${accessory.context.deviceId}) `)
		this.accessories.push(accessory)
	}
}