export default class {
	// ===============================================
	// Dependencias
	// ===============================================
	// ===============================================
	constructor() {
		this.title = 'TCP Socket'
		this.desc = 'Permite realizar una conexión TCP'
		this.icon = '󰐧'
		this.group = 'Transporte'
		this.color = '#3498DB'
		this.isTrigger = true

		this.addInput('input')
		this.addOutput('connect')
		this.addOutput('error')
		this.addOutput('disconnect')

		this.properties = {
			name: {
				label: 'Nombre del Servicio',
				type: 'string',
				value: ''
			},
			events: {
				label: 'Eventos a escuchar:',
				type: 'tags',
				description: 'Evento que escuchar eventos enviados desde el servidor',
				value: []
			},
			server: {
				label: 'Configuración de Server',
				type: 'group',
				object: {
					serverHost: {
						label: 'Host:',
						type: 'string',
						value: '127.0.0.1',
						size: 2
					},
					serverPort: {
						label: 'Puerto:',
						type: 'number',
						value: 3100,
						size: 2
					}
				},
				value: {
					serverHost: {
						value: '127.0.0.1'
					},
					serverPort: {
						value: 3100
					}
				}
			},
			divider1: {
				label: '',
				type: 'divider'
			},
			activeBidirectionalidad: {
				label: 'Habilitar conexión bidireccional',
				description:
					'Permite que el servicio se conecte con otros servicios TCP (Habilita la conexión como servidor)',
				type: 'switch',
				value: false
			}
		}
	}

	onCreate() {
		this.ui.outputs = []
		this.ui.outputs.push('connect')
		for (const value of this.properties.events.value) {
			this.ui.outputs.push(`event:${value}`)
		}
		this.ui.outputs.push('error')
		this.ui.outputs.push('disconnect')
	}

	async onExecute({ server, dependency, outputData }) {
		const net = await dependency.getRequire('node:net')
		let coordinatorSocket = null
		let coordinatorPreConnect = true
		const peerConnections = new Map()
		const serversConnections = new Map()

		try {
			const connectCoordinator = () => {
				coordinatorSocket = new net.Socket()
				connectCoordinatorEvents()
				coordinatorSocket.connect(
					this.properties.server.value.serverPort.value,
					this.properties.server.value.serverHost.value,
					() => {
						coordinatorPreConnect = true
					}
				)
			}

			const connectCoordinatorRetry = () => {
				coordinatorSocket = null
				setTimeout(() => {
					connectCoordinator()
				}, 1000)
			}

			const getMessage = (socket, data) => {
				try {
					const message = JSON.parse(data.toString())
					if (!message || !message.event || !message.data) {
						console.log(
							this.title,
							'Error: El mensaje debe de contener event y data',
							message
						)
						return
					}
					if (message.event.substring(0, 4) === 'tcp_') {
						return connectCoordinatorActions({ ...message })
					}
					outputData(`event:${message.event}`, message, {
						socket,
						serversConnections
					})
				} catch (__) {
					console.log(
						this.title,
						'Error: El mensaje no es un JSON válido',
						data.toString()
					)
				}
			}

			const connectCoordinatorEvents = () => {
				coordinatorSocket.on('connect', () => {
					outputData('connect', { data: 'connect' }, { serversConnections })
					coordinatorSocket.write(
						JSON.stringify({
							event: 'tcp_connect',
							data: {
								name: this.properties.name.value,
								url: `localhost:${server.port + 500}`
							}
						})
					)
				})
				coordinatorSocket.on('data', (data) => {
					getMessage(coordinatorSocket, data)
				})

				coordinatorSocket.on('error', (error) => {
					if (coordinatorPreConnect) {
						outputData('error', { error: error.toString() })
						// coordinatorPreConnect = false
					}
				})

				coordinatorSocket.on('close', () => {
					if (coordinatorPreConnect) {
						outputData('disconnect', {
							error: 'Connection to coordinator closed'
						})
						coordinatorPreConnect = false
					}
					connectCoordinatorRetry()
				})
			}

			const connectCoordinatorActions = ({ event, data }) => {
				if (event === 'tcp_list') {
					for (const { name, url } of data) {
						serversConnections.set(name, url)
					}
				}
			}

			// ---------------------------------------------------------------------------------
			// ------------------------------------- Server -------------------------------------
			// ---------------------------------------------------------------------------------

			const connectServer = () => {
				const peerServer = net.createServer((socket) => {
					const peerId = `${server.port + 500}`

					socket.on('data', (data) => {
						getMessage(socket, data)
					})

					socket.on('close', () => {
						peerConnections.delete(peerId)
					})
				})

				peerServer.listen(server.port + 500, () => {
					console.log(`TCP Socket: Puerto bidireccional ${server.port + 500}`)
				})
			}

			connectCoordinator()
			if (this.properties.activeBidirectionalidad.value) connectServer()
		} catch (error) {
			console.log('🚀 ~ onExecute ~ error:', error)
			outputData('error', { error: error.toString() })
		}
	}
}
