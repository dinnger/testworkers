import 'dotenv/config'
import fs from 'node:fs'
import { glob } from 'glob'
import { createRequire } from 'node:module'
import type { Express } from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import type { Filter, Options, RequestHandler } from 'http-proxy-middleware'

const require = createRequire(import.meta.url)
const { spawn, exec } = require('node:child_process')

export const workers = {}
let tempApp: Express | null = null
let tempPort = 4000

export class HorizonWorker {
	app: Express | null
	socket: any

	constructor({ app }: { app?: Express | null } = {}) {
		if (app) tempApp = app
		this.app = tempApp
		this.socket = null
	}

	/**
	 * Verifica si el puerto ya esta ocupado en linux
	 * @param {number} port
	 * @returns
	 */
	async workerVerifyPort({ port }) {
		const { exec } = await import('child_process')
		return new Promise((resolve) => {
			exec(`lsof -i:${port}`, (err, stdout, stderr) => {
				if (err) {
					resolve(false)
				} else {
					resolve(true)
				}
			})
		})
	}

	/**
	 * Cierra el puerto
	 * @param {number} port
	 * @returns
	 */
	async workerKillPort({ port }) {
		const { exec } = await import('child_process')
		return new Promise((resolve) => {
			exec(`kill -9 $(lsof -t -i:${port})`, (err, stdout, stderr) => {
				if (err) {
					console.log({ err })
					resolve(true)
				} else {
					resolve(true)
				}
			})
		})
	}

	// Crea un worker para un flujo persistente (despliegue local)
	// Cada 30 minutos se comprueba si hay cambios en el directorio
	// y se reinicia el worker si hay cambios
	async workerCreatePersistent({ type }) {
		this.workerCreate({ id: '*', type, isDev: true })

		setInterval(() => {
			fs.readdirSync('_flows_deploy').forEach((key) => {
				const dir = '_flows_deploy/' + key
				const folder = fs.readdirSync(dir)
				// console.log(workers[key])
				if (folder.find((f) => f === 'reload')) {
					console.log('Recreando')
					fs.unlinkSync(dir + '/reload')
					this.workerCreate({
						id: key,
						recreate: true,
						type,
						useTimeOut: false,
						isDev: false
					}) //
				}
			})
		}, 1000 * 30)
	}

	/**
	 * WorkerTimeOut
	 * Indica la vigencia de un worker y al llegar al timeout lo finaliza
	 * Se omiten los flujos iniciados como core (_flujo)
	 * @param {flow} param0
	 */
	workerTimeOut({ flow }) {
		const time = Number(process.env.FLOW_WORKER_TIMEOUT || 43200) * 1000
		console.log(
			'\x1b[46m[Worker]\x1b[0m',
			'\x1b[32m TIMEOUT > \x1b[0m',
			time / 1000,
			'seg'
		)
		clearTimeout(workers[flow].timeout)
		workers[flow].timeout = setTimeout(() => {
			if (workers[flow]) {
				const port = workers[flow].port
				console.log('KILL', port)
				workers[flow].worker.kill()
				delete workers[flow]
				workers[flow] = {
					port
				}
				this.workerKillPort({ port })
			}
		}, time)
	}

	/**
	 * Crea un worker para un flujo
	 * @param {Object} param0
	 * @param {string} param0.id - Identificador del flujo
	 * @param {string} param0.type - Tipo de flujo (flow, process)
	 * @param {boolean} param0.recreate - Indica si se debe recrear el worker
	 * @param {boolean} param0.useTimeOut - Indica si se debe usar el timeout
	 * @param {boolean} param0.isDev - Indica si se debe usar el modo desarrollo
	 * @returns {Promise<void>}
	 */
	async workerNew({ id, port, useTimeOut, type, isDev, dir }) {
		if (!workers[id] || workers[id].active === false) {
			if (!workers[id]) {
				workers[id] = {
					worker: null,
					port,
					recreate: false,
					active: true
				}
			}
			if (workers[id] && workers[id].port) port = workers[id].port
			const prefix = process.env.IS_SUBMODULE === 'true' ? '' : 'horizonSub/'
			workers[id].worker = spawn(
				'tsx',
				[`${prefix}horizonWorker/worker.ts`, type, dir, port, isDev],
				{ shell: true }
			)
			workers[id].users = {}
			workers[id].port = port
			workers[id].active = true
			workers[id].recreate = false
			workers[id].useTimeOut = useTimeOut
			workers[id].isDev = isDev
			// dir
			workers[id].dir = dir
			// Caducidad del flujo (development)
			if (useTimeOut) this.workerTimeOut({ flow: id })
		}

		workers[id].worker.stdout.on('data', (chunk) => {
			const txt = chunk.toString().trim()
			if (txt !== '') {
				console.log('\x1b[46m[Worker]\x1b[0m', '\x1b[32m LOG ---> \x1b[0m', txt)
				// Si en consola se envia como primer registro un *
				// Se tomara como instrucción del worker al principal
				if (txt[0] === '*') {
					const txtI = txt.split('>>')
					if (txtI[1] === 'socket_connect') workers[txtI[2]].users[txtI[3]] = 1
					if (txtI[1] === 'socket_disconnect')
						delete workers[txtI[2]].users[txtI[3]]
				}
			}
			// Si el servidor devuelve el texto Create
			if (txt === 'CREATE') {
				console.log(
					'\x1b[46m[Worker]\x1b[0m',
					'\x1b[32m CREATE --> \x1b[0m',
					id,
					port,
					useTimeOut ? 'useTimeout' : ''
				)
				return { id }
			}
			if (txt === '**RELOAD**') {
				console.log(
					'\x1b[46m[Worker]\x1b[0m',
					'\x1b[34m RELOAD --> \x1b[0m',
					id,
					port,
					useTimeOut ? 'useTimeout' : ''
				)
				const idFlow = id.split('.')[0]
				this.workerCreate({
					id: idFlow,
					recreate: true,
					type,
					useTimeOut,
					isDev
				})
			}
		})

		workers[id].worker.stderr.on('data', (chunk) => {
			const txt = chunk.toString().trim()
			console.log(
				'\x1b[46m[Worker]\x1b[0m',
				'\x1b[31m ERROR --> \x1b[0m',
				id,
				txt
			)
		})

		// Detecta el cierre del worker y lo pone en estado inactivo
		workers[id].worker.on('close', (code) => {
			if (code) {
				try {
					this.workerKillPort({ port: workers[id].port })
				} catch (e) {
					console.log(e)
				}
			}

			console.log(
				'\x1b[46m[Worker]\x1b[0m',
				'\x1b[31m ERROR --> \x1b[0m',
				id,
				`child process exited with code ${code}`
			)
			if (workers[id].recreate && workers[id].active) {
				const port = workers[id].port
				delete workers[id]
				setTimeout(
					() => this.workerNew({ id, port, useTimeOut, type, isDev, dir }),
					1000
				)
			}
			if (workers[id]) workers[id].active = false
		})

		return true
	}

	/**
	 * Crea un worker para un flujo
	 * @param {Object} param0
	 * @param {string} param0.id - Identificador del flujo
	 * @param {string} param0.type - Tipo de flujo (flow, process)
	 * @param {boolean} param0.recreate - Indica si se debe recrear el worker
	 * @param {boolean} param0.useTimeOut - Indica si se debe usar el timeout
	 * @param {boolean} param0.isDev - Indica si se debe usar el modo desarrollo
	 * @returns {Promise<void>}
	 */
	async workerCreate({
		id,
		type,
		recreate = false,
		useTimeOut = false,
		isDev = false,
		port = 0
	}: {
		id: string
		type: string
		recreate?: boolean
		useTimeOut?: boolean
		isDev?: boolean
		port?: number
	}) {
		let folder: string | null = null
		if (type === 'flow') folder = 'flows'
		if (type === 'flow_deploy') folder = 'flows_deploy'
		if (type === 'process') folder = 'processes'

		if (fs.existsSync(`./_${folder}`) === false) return

		// Directorio del flujo
		let dir: string | null = null

		// Validando nombre del flow
		if (id === '*') {
			fs.readdirSync(`./_${folder}`).forEach((id) => {
				this.workerCreate({ id, type, recreate, useTimeOut })
			})
			return
		} else {
			const flowDir = glob.sync(`./_${folder}/${id.replace('_prod', '')}.*`)
			if (flowDir.length === 0) return
			dir = flowDir[0]
			id = flowDir[0].replace(/\\/g, '/').split('/').pop() ?? ''
			if (!isDev) id = id + '_prod'
		}

		if (!dir) return

		// eslint-disable-next-line no-async-promise-executor
		//  Si el worker ya existe lo elimina
		const proxyExist = false

		// Si existe el worker
		if (workers[id] && workers[id].worker) {
			// Si no es necesario recrear retorna
			if (!recreate && workers[id].active) {
				if (useTimeOut) this.workerTimeOut({ flow: id })
				return true
			}
			// Recreando
			workers[id].recreate = recreate

			try {
				workers[id].worker.kill()
				exec(
					`kill -9 $(lsof -t -i:${workers[id].port} -sTCP:LISTEN)`,
					function (_err, stdout, stderr) {
						if (stdout) {
							console.log('stdout:' + stdout)
						}
						if (stderr) {
							console.log('stderr:' + stderr)
						}
					}
				)
			} catch (e) {
				console.log(e)
			}
			return true
			// proxyExist = true
		} else {
			tempPort += 1
			if (port === 0) port = tempPort
		}

		if (!proxyExist) {
			if (this.app) {
				/**
				 * Crea la referencia proxy
				 */
				let routerBase = null
				const folderBase = fs.readdirSync(dir)
				if (folderBase.length > 0) {
					const file = folderBase.filter(
						(file) => file.split('.').pop() === 'flow'
					)
					if (file.length > 0) {
						const model = fs.readFileSync(dir + '/' + file[0], 'utf8')
						if (model) {
							const modelData = JSON.parse(model)
							routerBase = modelData.properties?.config?.router?.base
						}
					}
				}
				const PATH_URL =
					process.env.PATH_URL?.slice(-1) === '/'
						? process.env.PATH_URL.toString().slice(0, -1)
						: process.env.PATH_URL
				const path = isDev
					? `${PATH_URL}/api/${type}_${id.split('.')[0]}`
					: `${PATH_URL}${routerBase}`
				// Iniciando el proxy
				this.app.use(
					createProxyMiddleware(`${path}/`, {
						ws: true,
						secure: false,
						target: 'http://127.0.0.1:' + port,
						changeOrigin: true
					})
				)
			}
		}

		// Verifica si el puerto ya esta ocupado
		if (await this.workerVerifyPort({ port })) {
			await this.workerKillPort({ port })
		}

		await this.workerNew({ id, port, useTimeOut, type, isDev, dir })

		return true
	}
}

if (process.argv[3]) {
	const parameter = {
		type: process.argv[2],
		file: process.argv[3],
		port: Number(process.argv[4]) || 3000,
		isDev: process.argv[5] === 'true'
	}
	const horizon = new HorizonWorker()
	const id = <string>parameter.file.split('/').pop()?.split('.')[0]
	horizon.workerCreate({
		id,
		type: 'flow',
		port: parameter.port,
		isDev: parameter.isDev,
		useTimeOut: parameter.isDev
	})
}
