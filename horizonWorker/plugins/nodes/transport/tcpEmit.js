export default class {
	// ===============================================
	// Dependencias
	// ===============================================
	// ===============================================
	constructor() {
		this.title = 'TCP Emit'
		this.desc = 'Permite realizar envió de información por TCP'
		this.icon = '󱘖'
		this.group = 'Transporte'
		this.color = '#3498DB'

		this.addOutput('response')
		this.addOutput('error')
		this.addOutput('disconnect')

		this.properties = {
			name: {
				label: 'Nombre del servicio destino',
				description:
					'El nombre del servicio destino proporciona la información necesaria para conectarse con él. (Siempre que se encuentre habilitado *Habilitar conexión bidireccional* y el servicio se encuentre conectado)',
				type: 'string',
				value: ''
			},
			events: {
				label: 'Eventos a enviar:',
				type: 'tags',
				description:
					'Evento que permiten enviar información para posteriormente ser enviadas al servicio destino.',
				value: []
			}
		}
	}

	onCreate() {
		this.ui.inputs = []
		for (const value of this.properties.events.value) {
			this.ui.inputs.push(`event:${value}`)
		}
	}

	async onExecute({ context, storage, dependency, inputData, outputData }) {
		const { v4 } = await dependency.getRequire('uuid')
		const net = await dependency.getRequire('node:net')
		let coordinatorSocket = null
		const node = context.getNodeByType('transport/tcp')
		if (!node) {
			return outputData('error', { error: 'No se encontró el nodo TCP Socket' })
		}

		if (
			!node.meta ||
			!node.meta.serversConnections ||
			!node.meta.serversConnections.get(this.properties.name.value)
		) {
			return outputData('error', {
				error: 'No se encontró el servicio destino'
			})
		}
		try {
			const unique = v4()
			const url = node.meta.serversConnections.get(this.properties.name.value)
			const [host, port] = url.split(':')
			const id = `${host}:${port}`

			const store = storage.context.get(id)
			if (store) {
				coordinatorSocket = store
				coordinatorSocket.write(
					JSON.stringify({
						unique,
						event: inputData.input.replace('event:', ''),
						data: inputData.data
					})
				)
				return
			}

			storage.context.set(id, coordinatorSocket)

			const connectService = () => {
				coordinatorSocket = new net.Socket()
				connectServiceEvents()
				coordinatorSocket.connect(Number.parseInt(port), host, () => {})
			}

			const connectServiceEvents = () => {
				coordinatorSocket.on('connect', () => {
					const event = inputData.input.replace('event:', '')
					const send = JSON.stringify({
						unique,
						event,
						data: inputData.data
					})
					coordinatorSocket.write(send)
				})

				coordinatorSocket.on('data', (value) => {
					try {
						const val = JSON.parse(value)
						if (typeof val === 'object' && val.unique && val.data) {
							if (val.unique === unique) {
								outputData('response', { data: val.data })
							}
						}
					} catch (error) {
						console.log({ error: error.toString() })
					}
				})

				coordinatorSocket.on('error', (error) => {
					storage.context.remove(id)
					outputData('error', { error: error.toString() })
				})

				coordinatorSocket.on('close', () => {
					storage.context.remove(id)
					outputData('disconnect', {
						error: 'Connection to coordinator closed'
					})
				})
			}

			connectService()
		} catch (error) {
			console.log('🚀 ~ onExecute ~ error:', error)
			outputData('error', { error: error.toString() })
		}
	}
}
