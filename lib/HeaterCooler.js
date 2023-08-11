let Characteristic, Service
const stateManager = require('./stateManager')

// mode - optional. 0 - OFF, 1 - HEAT/COOL, 2 - COOL, 3 - HEAT, 4 - FAN_ONLY, 5 - DRY, 6 - AUTO.
// fanMode - optional. 0 - ON, 1 - OFF, 2 - AUTO, 3 - LOW, 4 - MEDIUM, 5 - HIGH, 6 - MIDDLE, 7 - FOCUS, 8 - DIFFUSE, 9 - QUIET.
// swingMode - optional. 0 - OFF, 1 - BOTH, 2 - VERTICAL, 3 - HORIZONTAL.

class HeaterCooler {
	constructor(device, entity, state, platform) {
		Service = platform.api.hap.Service
		Characteristic = platform.api.hap.Characteristic
		this.config = entity.config
		this.esphome = entity
		this.log = platform.log
		this.api = platform.api
		this.id = this.config.uniqueId
		this.host = device.host
		this.name = device.name
		this.serial = this.id
		this.model = entity.name
		this.manufacturer = 'ESPHome'
		this.type = 'HeaterCooler'
		this.displayName = this.name
		this.state = state
		this.connected = true
		this.pending = []
		this.setDelay = 600

		if (this.config.supportedSwingModesList.length > 1)
			this.swingModeValue = this.config.supportedSwingModesList.includes(1) ? 1 : (this.config.supportedSwingModesList.includes(2) ? 2 : 3)

		this.UUID = this.api.hap.uuid.generate(this.id)
		this.accessory = platform.accessories.find(accessory => accessory.UUID === this.UUID)

		if (!this.accessory) {
			this.log(`Creating New ESPHome AC Accessory: "${this.name}"`)
			this.accessory = new this.api.platformAccessory(this.name, this.UUID)
			this.accessory.context.deviceId = this.id
			this.accessory.context.host = this.host

			// Set last Target State to cache
			this.accessory.context.lastTargetState = this.state.mode && [2,3,6].includes(this.state.mode) ? this.state.mode : 2

			platform.accessories.push(this.accessory)
			// register the accessory
			this.api.registerPlatformAccessories(platform.PLUGIN_NAME, platform.PLATFORM_NAME, [this.accessory])
		} else {
			this.log(`ESPHome device "${this.name}" is connected!`)

			// Set last Target State to cache
			if (this.state.mode && [2,3,6].includes(this.state.mode))
				this.accessory.context.lastTargetState = this.state.mode
		}

		let informationService = this.accessory.getService(Service.AccessoryInformation)

		if (!informationService)
			informationService = this.accessory.addService(Service.AccessoryInformation)

		informationService
			.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(Characteristic.Model, this.model)
			.setCharacteristic(Characteristic.SerialNumber, this.serial)

		
		this.addHeaterCoolerService()

		this.esphome.on('state', this.updateState.bind(this))

	}

	addHeaterCoolerService() {

		this.log.easyDebug(`Adding HeaterCooler service for "${this.name}"`)
		this.HeaterCoolerService = this.accessory.getService(Service.HeaterCooler)
		if (!this.HeaterCoolerService)
			this.HeaterCoolerService = this.accessory.addService(Service.HeaterCooler, this.name)

		this.HeaterCoolerService.getCharacteristic(Characteristic.Active)
			.onSet(stateManager.set.Active.bind(this))
			.updateValue(this.state.mode !== 0)


		const currentMode = this.state.mode === 0 ? 0 : 
			((this.state.mode === 2 || this.state.targetTemperature < this.state.currentTemperature) ? 3 : 
			(this.state.mode === 3 || this.state.targetTemperature > this.state.currentTemperature ? 2 : 1))

		this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
			.updateValue(currentMode)

		const props = []

		if (this.config.supportedModesList.includes(2)) props.push(Characteristic.TargetHeaterCoolerState.COOL)
		if (this.config.supportedModesList.includes(3)) props.push(Characteristic.TargetHeaterCoolerState.HEAT)
		if (this.config.supportedModesList.includes(6)) props.push(Characteristic.TargetHeaterCoolerState.AUTO)

		const targetMode = this.accessory.context.lastTargetState === 6 ? 0 : (this.accessory.context.lastTargetState === 3 ? 1 : this.accessory.context.lastTargetState)
		this.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState)
			.setProps({validValues: props})
			.onSet(stateManager.set.TargetHeaterCoolerState.bind(this))
			.updateValue(targetMode)


		this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentTemperature)
			.setProps({
				minValue: -100,
				maxValue: 100,
				minStep: 0.1
			})
			.updateValue(this.state.currentTemperature)


		if (this.config.supportedModesList.includes(2) || this.config.supportedModesList.includes(6))
			this.HeaterCoolerService.getCharacteristic(Characteristic.CoolingThresholdTemperature)
				.setProps({
					minValue: this.config.visualMinTemperature,
					maxValue: this.config.visualMaxTemperature,
					minStep: this.config.visualTargetTemperatureStep
				})
				.onSet(stateManager.set.CoolingThresholdTemperature.bind(this))
				.updateValue(this.state.targetTemperature)

	if (this.config.supportedModesList.includes(3) || this.config.supportedModesList.includes(6))
			this.HeaterCoolerService.getCharacteristic(Characteristic.HeatingThresholdTemperature)
				.setProps({
					minValue: this.config.visualMinTemperature,
					maxValue: this.config.visualMaxTemperature,
					minStep: this.config.visualTargetTemperatureStep
				})
				.onSet(stateManager.set.HeatingThresholdTemperature.bind(this))
				.updateValue(this.state.targetTemperature)

		if (this.swingModeValue) {
			this.HeaterCoolerService.getCharacteristic(Characteristic.SwingMode)
				.onSet(stateManager.set.SwingMode.bind(this))
				.updateValue(this.state.swingMode ? 1 : 0)
		}

		if (this.config.supportedFanModesList.length > 1) {
			this.HeaterCoolerService.getCharacteristic(Characteristic.RotationSpeed)
				.onSet(stateManager.set.RotationSpeed.bind(this))
		}

		this.updateState(this.state)

	}

	updateState(state) {
		this.log.easyDebug(`${this.name} Entity New State:`)
		this.log.easyDebug(state)

		this.state = state
			
		this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.state.currentTemperature)
		
		// if status is OFF, set all services to INACTIVE
		if (this.state.mode === 0) {
			this.HeaterCoolerService.getCharacteristic(Characteristic.Active).updateValue(0)
			this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(0)
			return
		}

		switch (this.state.mode) {
			case 2:
			case 3:
			case 6:

				this.accessory.context.lastTargetState = this.state.mode

				// turn on HeaterCoolerService
				this.HeaterCoolerService.getCharacteristic(Characteristic.Active).updateValue(1)

				// normalize temp
				if (this.state.targetTemperature < this.config.visualMinTemperature)
					this.state.targetTemperature = this.config.visualMinTemperature
				if (this.state.targetTemperature > this.config.visualMaxTemperature)
					this.state.targetTemperature = this.config.visualMaxTemperature

				// update temperatures for HeaterCoolerService
				if (this.config.supportedModesList.includes(3) || this.config.supportedModesList.includes(6))
					this.HeaterCoolerService.getCharacteristic(Characteristic.HeatingThresholdTemperature).updateValue(this.state.targetTemperature)
				if (this.config.supportedModesList.includes(2) || this.config.supportedModesList.includes(6))
					this.HeaterCoolerService.getCharacteristic(Characteristic.CoolingThresholdTemperature).updateValue(this.state.targetTemperature)

				// update swing for HeaterCoolerService
				if (this.swingModeValue)
					this.HeaterCoolerService.getCharacteristic(Characteristic.SwingMode).updateValue(this.state.swingMode ? 1 : 0)

				// update fanSpeed for HeaterCoolerService
				if (this.config.supportedFanModesList.length > 1) {
					const index = this.config.supportedFanModesList.indexOf(this.state.fanMode) + 1
					const totalFanModes = this.config.supportedFanModesList.length
					const speed = Math.ceil(index * (100/totalFanModes))
					this.HeaterCoolerService.getCharacteristic(Characteristic.RotationSpeed).updateValue(speed)
				}

				// set proper target and current state of HeaterCoolerService
				if (this.state.mode === 2) {
					this.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(Characteristic.TargetHeaterCoolerState.COOL)
					this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.COOLING)
				} else if (this.state.mode === 3) {
					this.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(Characteristic.TargetHeaterCoolerState.HEAT)
					this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.HEATING)
				} else if (this.state.mode === 6) {
					this.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(Characteristic.TargetHeaterCoolerState.AUTO)
					if (this.state.currentTemperature >= this.state.targetTemperature)
						this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.COOLING)
					else
						this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.HEATING)
				}
				break
			default:
				// act like AUTO but with IDLE
				this.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(Characteristic.TargetHeaterCoolerState.AUTO)
				this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.IDLE)
				break
		}
	}
}


module.exports = HeaterCooler