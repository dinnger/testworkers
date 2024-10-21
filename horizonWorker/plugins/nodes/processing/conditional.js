export default class {
	constructor({ ref, watch }) {
		this.title = 'Condicional'
		this.desc = 'Permite realizar una validación de datos de entrada'
		this.icon = '󱡷'
		this.group = 'Procesamiento'
		this.color = '#F39C12'

		this.addInput('input')
		this.addOutput('else')
		this.addOutput('error')

		this.ref = ref
		this.watch = watch

		this.properties = {
			options: {
				label: 'Condicionales:',
				type: 'list',
				object: {
					where: {
						label: 'Condición',
						type: 'string',
						value: ''
					}
				},
				value: []
			}
		}
	}

	onCreate({ context }) {
		this.ui.outputs = []
		this.properties.options.value.forEach((item, index) => {
			this.ui.outputs.push(`condición_${index + 1}`)
		})
		this.ui.outputs.push('else')
		this.ui.outputs.push('error')
	}

	async onExecute({ inputData, outputData }) {
		try {
			let valid = null
			let validGlobal = false
			valid = false
			this.properties.options.value.forEach((conditional, index) => {
				// eslint-disable-next-line no-eval
				eval(`valid = ${conditional.where.value}`)
				if (valid) {
					validGlobal = true
					return outputData('condición_' + (index + 1), inputData.data)
				}
			})
			// console.log(valid)
			if (!validGlobal) outputData('else', inputData.data)
		} catch (error) {
			outputData('error', error.toString())
		}
	}
}
