

let sendTimeout = null
const sendState = (that) => {
	clearTimeout(sendTimeout)
	sendTimeout = setTimeout(() => {
		that.log.easyDebug(`${that.name} - Sending command: ${JSON.stringify(that.state)}`)
		that.esphome.connection.climateCommandService(that.state);
	}, 600)
}


const HKToFanLevel = (value, fanSpeeds) => {

	let selected = 2
	if (!fanSpeeds.includes(2))
		selected = fanSpeeds[0]

	if (value !== 0) {
		// fanSpeeds = fanSpeeds.filter(speed => speed !== 'AUTO')
		const totalSpeeds = fanSpeeds.length
		for (let i = 0; i < fanSpeeds.length; i++) {
			if (value <= (100 * (i + 1) / totalSpeeds))	{
				selected = fanSpeeds[i]
				break
			}
		}
	}
	return selected
}

// let Characteristic
module.exports = {
	set: {
		Active: function(active, callback) {
			setTimeout(() => {
				this.state.mode = active ? this.accessory.context.lastTargetState : 0
				this.log(`${this.name} - Setting AC Active to ${active}`)
				sendState(this)
				callback()
			}, 200)
		},

		TargetHeaterCoolerState: function(state, callback) {
			let logMode = null
			switch (state) {
				case 0:
					this.state.mode = 6
					this.accessory.context.lastTargetState = 6
					logMode = 'AUTO'
					break;
				case 1:
					this.state.mode = 3
					this.accessory.context.lastTargetState = 3
					logMode = 'HEAT'
					break;
				case 2:
					this.state.mode = 2
					this.accessory.context.lastTargetState = 2
					logMode = 'COOL'
					break;
			}
			
			this.log(`${this.name} - Setting AC Mode to ${logMode}`)
			sendState(this)
			callback()
		},

		CoolingThresholdTemperature: function(temp, callback) {
			if (this.state.targetTemperature !== temp) {
				setTimeout(() => {
					this.state.targetTemperature = temp
					this.log(`${this.name} - Setting AC Cooling Temperature to ${temp}ºC`)
					sendState(this)
				},50)
			}
			callback()
		},

		HeatingThresholdTemperature: function(temp, callback) {
			if (this.state.targetTemperature !== temp) {
				setTimeout(() => {
					this.state.targetTemperature = temp
					this.log(`${this.name} - Setting AC Heating Temperature to ${temp}ºC`)
					sendState(this)
				},50)
			}
			callback()
		},

		SwingMode: function(swing, callback) {
			this.state.swingMode = swing ? this.swingModeValue : 0
			this.log(`${this.name} - Setting AC Swing to ${swing ? 'ON' : 'OFF'}%`)
			sendState(this)
			callback()
		},

		RotationSpeed: function(speed, callback) {
			this.state.fanMode = HKToFanLevel(speed, this.config.supportedFanModesList)
			this.log(`${this.name} - Setting AC Fan Level to ${speed}%`)
			sendState(this)
			callback()
		}
	}
}