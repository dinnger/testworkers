// Builder pattern
import 'dotenv/config'
import fs from 'fs'

import path from 'node:path'
import os from 'node:os'

import { glob } from 'glob'
import { Modeler } from './modeler'
import { ref, watch } from 'vue'

import express from 'express'
import bodyParser from 'body-parser'
import http from 'http'
import cors from 'cors'

import { HelperExecute } from './workerHelper.ts'
import { Execute } from './workerExecute.ts'
import { createRequire } from 'node:module'
import { ExecuteSocket } from './workerSocket.ts'
const require = createRequire(import.meta.url)

class Utils {
	static convertJson(text: string) {
		try {
			return JSON.parse(text)
		} catch (error) {
			return false
		}
	}
}

/**
 * Represents a Worker.
 * @class
 */
export class Worker {
	execute: any
	model: any
	modelData: any
	nodes: any
	app: any
	server: any
	storageContext: any
	environment: any
	variables: any

	constructor() {
		this.model = {
			name: '',
			path: '',
			data: null
		}
		this.nodes = []
		this.storageContext = {}
		this.environment = {}
		this.variables = {}
		this.loadNodes()
	}

	getFile({ idFlow }: { idFlow: string }) {
		const path = `_flows/${idFlow}`
		const files = glob.sync(`${path}.*`)
		return files || []
	}

	setEnvironment(env: Object) {
		this.environment = env
	}

	loadServer({ port = 3000 }): Promise<any> {
		this.app = express()

		const allowedOrigins = '*'
		const corsOptions = {
			origin: allowedOrigins,
			credentials: true,
			exposedHeaders: ['set-cookie']
		}

		return new Promise((resolve) => {
			this.app.use(bodyParser.urlencoded({ extended: true }))
			this.app.use(bodyParser.json())
			this.app.use(bodyParser.text({ type: 'text/*' }))
			this.app.use(bodyParser.text({ type: '*/xml' }))
			this.app.use(cors(corsOptions))
			this.app.set('trust proxy', 1)
			this.app.use(cors())

			this.server = http.createServer(this.app)
			this.server.port = port
			this.server.listen(port, () => {
				console.log('SERVER INIT: ', port)
				resolve(this)
			})
		})
	}

	loadNodes() {
		let path = ''
		let replace = ''
		if (fs.existsSync('./horizonWorker')) {
			path = './horizonWorker/plugins/nodes'
			replace = 'horizonWorker/'
		} else {
			path = './horizonSub/horizonWorker/plugins/nodes'
			replace = 'horizonSub/horizonWorker/'
		}
		const files = glob.sync(`${path}/**/*.js`)
		files.forEach((file: string) => {
			file = file.replace(/\\/g, '/')
			const valid = file.indexOf('/_') < 0
			if (!valid) return
			this.nodes.push({
				path: file.split('/nodes/').pop()?.replace('.js', ''),
				class: require(`./${file.replace(replace, '')}`)
			})
		})
	}

	loadVariables({ file }: { file: string }) {
		const variables = WorkerFile.getJson({ file: `${file}/flow.conf` })
		if (!variables) {
			this.variables = {}
			return this
		}
		this.variables = variables
		return this
	}

	async loadModel({ file }: { file: string }) {
		const flow = file.split('.').pop()
		this.model.name = flow
		this.model.path = `${file}/${flow}.flow`

		const model = WorkerFile.getJson({ file: this.model.path })

		if (!model) throw new Error('Flow no es valido')
		this.modelData = { ...model }

		const modeler = new Modeler()
		await modeler.modelLoad({ model, nodes: this.nodes })
		this.model.data = modeler

		return this
	}

	getNodeClass() {
		return this.nodes
			.map((m) => {
				try {
					if (!m.class || !m.class.default) return {}
					if (
						m.class.default.toString().toLowerCase().indexOf(' import(') >= 0
					) {
						console.error(
							' || ',
							'El nodo ',
							m.path,
							'contiene imports, no se cargara.'
						)
						return {}
					}
					const c = new m.class.default({ ref, watch })
					return {
						type: m.path,
						...JSON.parse(JSON.stringify(c)),
						onCreateExist: !!c.onCreate
					}
				} catch (error) {
					console.log('Error node class: ', error)
					return {
						type: m.path,
						error: error.toString()
					}
				}
			})
			.filter((f) => f.type)
	}

	async initExecute({
		init = true,
		initConsole = true,
		initNode = null,
		initData = null,
		io = null
	} = {}) {
		this.execute = new Execute({
			el: {
				model: this.model.data,
				modelPath: this.model.path,
				app: this.app,
				server: this.server,
				storageContext: this.storageContext,
				environment: this.environment,
				variables: this.variables
			}
		})
		if (io) this.execute.io = io
		if (init) await this.execute.init({ initConsole, initNode, initData })
	}

	async initSocket() {
		// Socket
		if (!this.execute) return console.error('No se ha inicializado el execute')
		const helper = new HelperExecute({
			el: this.execute,
			node: null,
			execNode: {}
		})
		const context = helper.context()
		const environment = helper.environment()
		const prefix = `/api/flow_${context.properties.value.id}`
		const pathUrl =
			(environment.path_url || '').slice(-1) !== '/'
				? environment.path_url
				: (environment.path_url || '').slice(0, -1)
		const path = pathUrl + prefix
		const socket = new ExecuteSocket({
			server: this.server,
			path,
			model: this.modelData,
			flowFile: this.model.path,
			nodes: this.nodes,
			nodeClass: this.getNodeClass(),
			variables: this.variables,
			environment: helper.environment()
		})
		const io = await socket.init()

		this.execute.io = io
		this.execute.init()
	}
}

/**
 * A class that provides utility functions for working with worker files.
 */
export const WorkerFile = {
	/**
	 * Reads a JSON configuration file from the specified directory and converts it to a JavaScript object.
	 *
	 * @param file - The directory path where the configuration file is located.
	 * @returns The parsed JSON object if the file exists, otherwise `null`.
	 */
	getJson({ file }: { file: string }) {
		if (!fs.existsSync(file)) {
			return null
		}
		const data = fs.readFileSync(file, 'utf-8')
		return Utils.convertJson(data)
	},

	/**
	 * Writes a JSON object to a file.
	 *
	 * @param file - The directory path where the configuration file is located.
	 * @param data - The JSON object to be written.
	 */
	setJson({ file, data }: { file: string; data: any }) {
		// if (!fs.existsSync(file)) fs.mkdirSync(file, { recursive: true })
		fs.writeFileSync(file, JSON.stringify(data, null, ' '))
	}
}

if (process.argv[3]) {
	const parameter = {
		type: process.argv[2],
		file: process.argv[3],
		port: Number(process.argv[4]) || 3000,
		isDev: process.argv[5] === 'true'
	}

	const worker = new Worker()
	await worker.setEnvironment({ isDev: parameter.isDev })
	await worker.loadServer({ port: parameter.port })
	await worker.loadVariables({ file: parameter.file })
	await worker.loadModel({ file: parameter.file })
	await worker.initExecute({ init: !parameter.isDev })
	if (parameter.isDev) await worker.initSocket()

	// const start = Date.now()
	// const LOG_FILE = path.join(`${parameter.port}-memory-usage.csv`)

	// setInterval(() => {
	// 	const memory = process.memoryUsage()
	// 	const memoryUsage = Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100
	// 	const time = Date.now() - start
	// 	fs.appendFileSync(LOG_FILE, `${memoryUsage}\n`)
	// }, 1000 * 5)
}
