const { Client } = require('@2colors/esphome-native-api');
const HeaterCooler = require('./HeaterCooler')

module.exports = {
	init: function() {


		this.devices.forEach(device => {
			const client = new Client({
				host: device.host,
				port: device.port || 6053,
				encryptionKey: device.encryptionKey || '',
				clearSession: false,
				reconnectInterval: 5000
			});


			const addNewAccessory = entity => {
				this.log.easyDebug('Entity Detected:')
				this.log.easyDebug(entity)
				if (entity.type === 'Climate') {
					entity.once('state', (state) => {
						this.log.easyDebug(`${device.name} Entity State:`)
						this.log.easyDebug(state)
						this.log(`Initializing Heater Cooler Accessory - ${device.name}`)
						this.esphomeDevices[entity.config.uniqueId] = new HeaterCooler(device, entity, state, this)
						client.off('newEntity', addNewAccessory);

						client.on('disconnected', () => {
							this.log(`${device.name} client disconnected!`)
							this.esphomeDevices[entity.config.uniqueId].connected = false
						})
				
						client.on('connected', () => {
							this.log(`${device.name} client reconnected`)
							this.esphomeDevices[entity.config.uniqueId].connected = true
						})
					});
				} else {
					this.log.easyDebug(`Not a Climate type device - ${entity.name} (${entity.type}) !`)
				}
			}

			client.connect();

			client.on('newEntity', addNewAccessory);
			
			client.on('error', (err) => {
				this.log.error(`${device.name} Error Occurred:`)
				this.log.error(err.stack || err.message || err)
				this.log.easyDebug(err)
			});
			
		})

		// remove deleted devices
		this.accessories.forEach(accessory => {
			
			if (this.devices.find(device => device.host === accessory.context.host))
				return

			// unregistering accessory
			this.log(`Unregistering deleted device: "${accessory.displayName}" | ID:${accessory.context.deviceId} | Host: ${accessory.context.host} `)
			this.api.unregisterPlatformAccessories(this.PLUGIN_NAME, this.PLATFORM_NAME, [accessory])
		});
	}
}