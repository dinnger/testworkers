import 'dotenv/config'
import fs from 'node:fs'
import { loggerInstance } from './workerExecuteLogs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const isDev = process.env.NODE_ENV === 'development'

export class HelperExecute {
	Worker: any
	Execute: any
	el: any
	io: any
	node: any
	nodeC: any
	execNode: any

	constructor({
		Worker,
		Execute,
		el,
		node,
		nodeC,
		execNode
	}: {
		Worker?: any
		Execute?: any
		el: any
		node: any
		nodeC?: any
		execNode: any
	}) {
		this.el = el
		this.io = el?.io
		this.node = node
		this.nodeC = nodeC
		this.execNode = execNode || {}
		this.Worker = Worker
		this.Execute = Execute
	}

	app() {
		return this.el.app
	}

	server() {
		return this.el.server
	}

	storage() {
		return {
			execute: {
				get: ({ key }) => {
					return this.el.storageExecute[key]
				},
				set: ({ key, value }) => {
					this.el.storageExecute[key] = value
				},
				remove: ({ key }) => {
					delete this.el.storageExecute[key]
				}
			},
			context: {
				get: ({ key }) => {
					return this.el.storageContext[key]
				},
				set: ({ key, value }) => {
					this.el.storageContext[key] = value
				},
				remove: ({ key }) => {
					delete this.el.storageContext[key]
				}
			}
		}
	}

	dependency() {
		return {
			getRequire: async (name) => {
				try {
					return require(name)
				} catch (error) {
					return null
				}
			},
			getImport: async (name) => {
				try {
					return await import(name)
				} catch (error) {
					return null
				}
			}
		}
	}

	environment({ executionEnvironment = {} } = {}) {
		return {
			log_level: process.env.LOG_LEVEL,
			log_path: process.env.LOG_PATH,
			base_url: process.env.BASE_URL,
			path_url: process.env.PATH_URL,
			...executionEnvironment
		}
	}

	logger() {
		const name = this.el.modelPath.split('/')[1]
		return {
			info: (data, message) => loggerInstance({ name }).info(data, message),
			error: (data, message) => loggerInstance({ name }).error(data, message)
		}
	}

	context() {
		const model = this.el.model
		return {
			properties: model.properties,
			ifExecute: () => !!this.execNode[this.node.id],
			getNodeByType: (type) => {
				const nodes = Object.entries(this.execNode).map((m) => m[1])
				return nodes.find((f: any) => f.type === type)
			},
			getNodeByName: (name) => {
				const nodes = Object.entries(this.execNode).map((m) => m[1])
				return nodes.find((f: any) => f.name === name)
			},
			subFlow: async ({
				idFlow,
				idSubFlow,
				idNode,
				data,
				outputData,
				outputDefault
			}) => {
				const worker = new this.Worker()
				const files = await worker.getFile({ idFlow: idSubFlow })
				if (files.length === 0) return console.error('SubFlow no encontrado')
				const file = files[0]
				worker.app = this.el.app
				worker.server = this.el.server
				await worker.setEnvironment({
					isDev,
					isSubFlow: true,
					subFlowParent: idFlow,
					subFlowBase: model.properties.value.config?.router?.base
				})
				await worker.loadVariables({ file })
				await worker.loadModel({ file })
				await worker.initExecute({
					initConsole: false,
					initNode: idNode,
					initData: data,
					io: this.el.io
				})
				// console.log('subFlow', idFlow, idSubFlow, idNode, data, outputData, outputDefault)
			}
		}
	}

	execute() {
		const execute = this.el.execute
		return {
			execute,
			stop: () => {
				this.el.executeStop = true
			}
		}
	}

	output = (output, data, meta = null) => {
		// Nodo normal sin ejecución multiInstancias
		// Se ejecuta dentro del mismo hilo de la ejecución del trigger
		this.execNode[this.node.id] = {
			id: this.node.id,
			name: this.node.title,
			type: this.node.type,
			data,
			meta
		}

		const hrTime = process.hrtime()
		this.nodeC.properties.time.finishTime = parseFloat(
			(hrTime[0] * 1000 + hrTime[1] / 1000000).toFixed(3)
		)
		const durationTime = (
			this.nodeC.properties.time.finishTime -
			this.nodeC.properties.time.initTime
		).toFixed(3)

		// Contador de outputs
		this.node.metrics.counts.outputs++

		// Socket
		if (this.io) {
			this.io.emit('client/execute', {
				name: this.el.execute,
				data: { idNode: this.node.id, metrics: this.node.metrics }
			})
			this.io.emit('client/debug', {
				idExecute: this.el.execute,
				node: {
					id: this.node.id,
					title: this.node.title,
					icon: this.nodeC.icon,
					type: this.nodeC.type
				},
				type: 'output',
				connectName: output,
				data,
				time: { durationTime, accumulativeTime: 0 }
			})
		}

		const next = this.node.connect.filter((f) => f.output === output)
		for (const f of next) {
			const idNode = f.id
			const input = f.input
			const node = this.el.model.nodes.value[idNode]

			const pool = {
				origin: this.node.id,
				destiny: f.id,
				input: f.input,
				inputIndex: this.el.model.nodes.value[f.id].ui.inputs.findIndex(
					(ui) => ui === f.input
				),
				output: f.output,
				outputIndex: this.el.model.nodes.value[
					this.node.id
				].ui.outputs.findIndex((ui) => ui === f.output),
				time: 0,
				active: true
			}

			// setTimeout(() => {
			if (this.io) this.io.emit('client/pool', { name: this.el.execute, pool })
			const exec = new this.Execute({ el: this.el })
			exec.nodeExecute({
				node,
				data,
				input,
				execNode: { ...this.execNode },
				storageExecute: { ...this.el.storageExecute }
			})
			// }, 1)
		}
	}
}

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class HelperSocket {
	static environment() {
		return {
			log_level: process.env.LOG_LEVEL,
			log_path: process.env.LOG_PATH,
			base_url: process.env.BASE_URL,
			path_url: process.env.PATH_URL
		}
	}

	static fn({ flowFile }: { flowFile?: string }) {
		return {
			mask: ({
				text,
				prefix,
				suffix
			}: { text: string; prefix?: string; suffix?: string }) => {
				const regexInit = /{{[^}]*}}/g
				const reg = text.toString().match(regexInit)
				if (reg && reg.length > 0) {
					reg.forEach((element: string) => {
						const newElement =
							prefix +
							<string>(
								element.replace('{{', '').replace('}}', '').split('.').pop()
							) +
							suffix
						text = text.replace(element, newElement)
					})
				}
				return text
			},
			getResourcesByType({ type }) {
				const file = (flowFile || '').replace(/\\/g, '/')
				let path = file.split('/').slice(0, -1).join('/')
				path = `${path}/_resources/${type}`
				// get all files
				const files = fs.readdirSync(path, { withFileTypes: true })

				return files
					.filter((file) => file.isFile())
					.map((file) => file.name.replace('.resource', ''))
			},
			getResource({ type, name }) {
				const file = (flowFile || '').replace(/\\/g, '/')
				let path = file.split('/').slice(0, -1).join('/')
				path = `${path}/_resources/${type}/${name}.resource`
				if (!fs.existsSync(path)) return null
				try {
					return JSON.parse(fs.readFileSync(path, 'utf-8'))
				} catch (error) {
					return null
				}
			},
			getFlowsList: async () => {
				const path = './_flows'
				const list = fs
					.readdirSync(path, { withFileTypes: true })
					.filter((dirent) => dirent.isDirectory())
					.map((dirent) => dirent.name)
				return list.map((m) => {
					const id = parseInt(m.split('.')[0])
					const name = m.split('.').pop()
					const namespace = m
						.split('.')
						.slice(1, m.split('.').length - 1)
						.join('.')
					return {
						id,
						name,
						namespace,
						path: m
					}
				})
			},
			getFlowsNodes: async ({ idFlow, type }) => {
				const arr = await this.fn().getFlowsList()
				if (arr.length === 0) return []
				const exist = arr.find((f) => f.id === idFlow)
				if (!exist) return []

				const path = './_flows/' + exist.path + '/' + exist.name + '.flow'
				const data = JSON.parse(fs.readFileSync(path, 'utf-8'))

				const nodes: any = []
				data.nodes.forEach((value) => {
					if (value.type === type) {
						nodes.push({
							id: value.id,
							title: value.title,
							properties: value.properties
						})
					}
				})
				return nodes
			}
		}
	}
}
