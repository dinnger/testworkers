export default class {
	// ===============================================
	// Dependencias
	// ===============================================
	// ===============================================
	constructor() {
		this.title = 'TCP Response'
		this.desc = 'Permite responder a una petición TCP'
		this.icon = '󱘖'
		this.group = 'Transporte'
		this.color = '#3498DB'

		this.addInput('input')
		this.addOutput('error')
		this.addOutput('disconnect')

		this.properties = {
			response: {
				label: 'Respuesta de la petición',
				type: 'code',
				lang: ['json', 'Json'],
				value: '{\n\n}'
			}
		}
	}

	async onExecute({ context, server, dependency, inputData, outputData }) {
		const { v4 } = await dependency.getRequire('uuid')
		const node = context.getNodeByType('transport/tcp')
		if (!node) {
			return outputData('error', { error: 'No se encontró el nodo TCP Socket' })
		}

		if (!node.meta || !node.meta.socket) {
			return outputData('error', {
				error: 'No se encontró el evento de la petición'
			})
		}
		try {
			const unique =
				typeof node.data === 'object' && node.data.unique
					? node.data.unique
					: v4()

			const event =
				typeof node.data === 'object' && node.data.event
					? node.data.event
					: inputData.input
			const socket = node.meta.socket
			socket.write(
				JSON.stringify({
					unique,
					event,
					data: this.properties.response.value
				})
			)
		} catch (error) {
			console.log('🚀 ~ onExecute ~ error:', error)
			outputData('error', { error: error.toString() })
		}
	}
}
