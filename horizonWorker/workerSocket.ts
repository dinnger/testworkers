import { Modeler } from './modeler'
import { WorkerFile } from './worker'
import { HelperSocket } from './workerHelper'
import { ref, watch } from 'vue'

export interface IExecuteSocket {
	model: any
	flowFile: any
	nodes: any
	nodeClass: any
	variables: any
	environment: any
	server: any
	path?: string
	session?: any
	allowedOrigins?: string
}

export class ExecuteSocket {
	model: any
	nodes: any
	nodeClass: any
	flowFile: any
	variables: any
	environment: any
	server: any
	allowedOrigins: string
	session: any
	path: string
	socket: any
	io: any
	register: any

	constructor({
		model,
		nodes,
		nodeClass,
		flowFile,
		variables,
		environment,
		server,
		session,
		path = '',
		allowedOrigins = '*'
	}: IExecuteSocket) {
		this.model = model
		this.nodes = nodes
		this.nodeClass = nodeClass
		this.flowFile = flowFile.replace(/\\/g, '/')
		this.variables = variables
		this.environment = environment
		this.server = server
		this.allowedOrigins = allowedOrigins
		this.path = path
		this.session = session
		this.register = {}
		this.socket = null
		this.io = null
	}

	async init() {
		const { Server: SocketServer } = await import('socket.io')
		this.initListEvents()
		if (process.env.IS_SUBMODULE === 'true') await this.initServerTemp()
		return new Promise((resolve) => {
			console.log('INIT SOCKET', this.path + '/socket.io')
			this.io = new SocketServer(this.server, {
				maxHttpBufferSize: 1e8,
				path: this.path + '/socket.io',
				cors: {
					credentials: true,
					origin: this.allowedOrigins
				}
			})
			this.initEvents()
			resolve(this.io)
		})
	}

	async initServerTemp() {
		const { Server: SocketServer } = await import('socket.io')
		console.log('INIT SOCKET TEMP', '/socket.io')
		const io = new SocketServer(this.server, {
			maxHttpBufferSize: 1e8,
			path: '/socket.io',
			cors: {
				credentials: true,
				origin: this.allowedOrigins
			}
		})
		io.on('connection', async (socket) => {
			socket.on('security/session/get', (callback) => callback(1))
			socket.on('worker/init', ({ id, type }, callback) => callback({ id: 1 }))
			socket.on('node/doc', async ({ name }, callback) => {
				const fs = await import('node:fs')
				const path = `./docusaurus/docs/integrations/${name.toLowerCase()}.md`
				if (!fs.existsSync(path)) {
					return callback({ error: 'No se encuentra la documentación' })
				}
				callback(fs.readFileSync(path, 'utf-8'))
			})
		})
	}

	emit(event: string, data: any) {
		this.io.emit(event, data)
	}

	on(event: string, callback: any) {
		this.io.on(event, callback)
	}

	getNodeClass(id: string) {
		console.log('NODE ', id)
	}

	initListEvents() {
		this.register = {
			//model
			model: () => {
				if (!this.session) return {}
				return {
					//model/info
					info: () => {
						return {
							//model/info/get
							get: () => {
								return {
									model: this.model,
									environment: this.environment,
									variables: this.variables,
									nodeClass: this.nodeClass
								}
							}
						}
					},
					//model/method
					method: () => {
						return {
							//model/method/create
							create: async ({ node, fieldChange }) => {
								const nodeNew = JSON.parse(JSON.stringify(node.properties))
								try {
									const nodeClass = this.nodes.find((f) => f.path === node.type)
									if (!nodeClass)
										return { error: 'No se encuentra la clase del nodo' }
									const nodeC = new nodeClass.class.default({ ref, watch })
									nodeC.properties = node.properties
									nodeC.ui = node.ui
									await nodeC.onCreate({
										context: this.model,
										fieldChange,
										environment: HelperSocket.environment(),
										fn: HelperSocket.fn({ flowFile: this.flowFile })
									})

									const properties = {}
									for (const [key, val] of Object.entries(nodeNew)) {
										if (typeof val === 'object' && val !== null) {
											for (const [key2, val2] of Object.entries(val)) {
												if (
													JSON.stringify(val2) !==
													JSON.stringify(nodeC.properties[key][key2])
												) {
													properties[key] = {
														...properties[key],
														[key2]: nodeC.properties[key][key2]
													}
												}
											}
										}
									}
									return { properties, ui: nodeC.ui }
								} catch (error) {
									return { error: error.toString() }
								}
							}
						}
					}
				}
			},
			//actions
			actions: () => {
				const modeler = new Modeler()
				return {
					// actions/save
					save: ({ data, variables }) => {
						const fileConfig =
							this.flowFile.split('/').slice(0, -1).join('/') + '/flow.conf'
						WorkerFile.setJson({
							file: this.flowFile,
							data: modeler.modelSave({ data, session: this.session })
						})
						WorkerFile.setJson({ file: fileConfig, data: variables || {} })
						return true
					},
					// actions/reload
					reload: () => console.log('**RELOAD**')
				}
			},
			//session
			session: () => {
				return {
					//session/set
					set: ({ session }) => {
						this.session = session
						return true
					}
				}
			}
		}
	}

	async initEvents() {
		if (this.session) this.io.engine.use(this.session)
		this.io.on('connection', async (socket) => {
			// Captura el nombre del evento y lo busca en el registro
			socket.onAny((event, ...args) => {
				const session = socket.session
				const params =
					args.length > 0 ? (typeof args[0] === 'object' ? args[0] : {}) : {}
				const callback =
					args.length === 2
						? args[1]
						: typeof args[0] === 'function'
							? args[0]
							: null
				const obj = event.split('/')
				let tempRegister = this.register
				const exec = async (index) => {
					if (index >= obj.length) {
						if (callback) callback(tempRegister)
						return
					}
					const name = obj[index]
					if (tempRegister[name]) {
						try {
							tempRegister = await tempRegister[name]({
								socket,
								session,
								...params
							})
						} catch (error) {
							tempRegister = { error: error.toString() }
						}
						exec(index + 1)
					} else {
						if (callback) callback(null)
						console.log('No existe el registro ', event, name)
					}
				}
				exec(0)
			})
		})
	}
}
