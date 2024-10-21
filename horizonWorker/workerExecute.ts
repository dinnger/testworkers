import type { Modeler } from './modeler'
import { v4 as uuidv4 } from 'uuid'
import { initProperties } from './workerExecuteProperties.ts'
import { ref, watch } from 'vue'
import { HelperExecute, HelperSocket } from './workerHelper.ts'
import { Worker } from './worker.ts'

interface IExecute {
	execute?: string
	executeParent?: string
	executeNode?: any
	executeStop?: boolean
	model: any
	modelPath: string
	app: any
	server: any
	storageExecute?: any
	storageContext?: any
	environment?: any
	variables?: any
	emit?: any
	io?: any
}

/**
 * Represents an execution object.
 */
export class Execute {
	execute?: string
	executeParent?: string
	executeNode?: any
	executeStop?: boolean
	environment?: any
	variables?: any
	model: Modeler
	modelPath: string
	app: any
	server: any
	storageContext: any
	storageExecute: any
	io: any

	constructor({ el }: { el?: IExecute }) {
		this.execute = uuidv4()
		this.executeParent = el?.executeParent || el?.execute
		this.executeStop = el?.executeStop || false
		this.model = el?.model || null
		this.modelPath = el?.modelPath || ''
		this.app = el?.app || null
		this.server = el?.server || null
		this.environment = el?.environment || {}
		this.variables = el?.variables || {}
		// Storage
		this.storageExecute = {}
		this.storageContext = el?.storageContext
		this.io = el?.io || null
	}

	init({ initConsole = true, initNode = null, initData = null } = {}) {
		if (initConsole) this.initConsole()
		if (initNode) {
			this.flowExecute({ idNode: initNode, data: initData })
			return
		}
		this.model.getNodes().forEach((value: any) => {
			if (value.type === 'triggers/init') {
				this.flowExecute({ idNode: value.id, data: null })
			}
		})
	}

	initConsole() {
		const cl = console.log
		console.log = (...args) => {
			if (this.io) this.io.emit('client/console', args)
			cl.apply(console, args)
		}
	}

	flowExecute({ idNode, data }: { idNode: string; data: any }) {
		const node = this.model.nodes.value[idNode]
		this.nodeExecute({ node, data })
	}

	/**
	 * Executes a node.
	 *
	 * @param node - The node to execute.
	 * @param data - The data to be used during execution.
	 * @param input - Optional input data.
	 * @param storageExecute - Optional storageExecute data.
	 * @returns `false` if the node is disabled or if the node type is not supported, otherwise `void`.
	 */
	nodeExecute({
		node,
		data,
		input = null,
		execNode = null,
		storageExecute = {}
	}: {
		node: any
		data: any
		input?: any
		execNode?: any
		storageExecute?: any
	}) {
		if (this.executeStop) return false
		if (node.disabled) return false
		if (!this.model.nodesClass[node.type]) return false

		this.storageExecute = storageExecute

		// Nueva instancia del nodo
		const hrTime = process.hrtime()
		const NodeClass = this.model.nodesClass[node.type].class
		const nodeC = new NodeClass({ ref, watch })
		nodeC.title = node.title
		nodeC.properties = {
			...nodeC.properties,
			...node.properties,
			time: {
				initTime: Number.parseFloat(
					(hrTime[0] * 1000 + hrTime[1] / 1000000).toFixed(3)
				),
				finishTime: null
			}
		}

		nodeC.callbackCount = 0

		try {
			const helper = new HelperExecute({
				Worker,
				Execute,
				el: this,
				node,
				nodeC,
				execNode
			})
			if (!node.metrics) node.metrics = { counts: { inputs: 0, outputs: 0 } }

			if (nodeC.properties)
				nodeC.properties = initProperties({
					properties: nodeC.properties,
					node,
					input: { data },
					context: helper.context(),
					variables: this.variables,
					storage: helper.storage()
				})

			// Contador de inputs
			node.metrics.counts.inputs++

			if (this.io)
				this.io.emit('client/execute', {
					name: this.execute,
					data: { idNode: node.id, metrics: node.metrics }
				})

			nodeC.onExecute({
				app: helper.app(),
				server: helper.server(),
				storage: helper.storage(),
				dependency: helper.dependency(),
				environment: helper.environment({
					executionEnvironment: this.environment
				}),
				logger: helper.logger(),
				execute: helper.execute(),
				context: helper.context(),
				inputData: { data, input },
				outputData: helper.output,
				fn: HelperSocket.fn({ flowFile: this.modelPath })
			})
		} catch (error) {
			console.error(error)
		}
	}
}
