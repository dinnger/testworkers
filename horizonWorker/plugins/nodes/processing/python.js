export default class {
	// ===============================================
	// Dependencias
	// ===============================================
	// #pre RUN apt-get update
	// #pre RUN apt-get install python3 -y
	// #pre RUN apt-get -y install python3-pip
	// #pre RUN apt install python3-testresources -y
	// #pre RUN mv /usr/lib/python3.11/EXTERNALLY-MANAGED /usr/lib/python3.11/EXTERNALLY-MANAGED.old
	// #pre RUN pip install "python-socketio[client]"
	// #pre RUN pip install python-dotenv
	// ===============================================

	constructor({ ref, watch }) {
		this.title = 'Python'
		this.desc = 'Permite ejecutar código python de forma nativa.'
		this.icon = '󰌠'
		this.group = 'Procesamiento'
		this.color = '#F39C12'
		// this.addProperty('msg', '')
		this.addInput('input')
		this.addOutput('response', 0)
		this.addOutput('error', 1)

		this.ref = ref
		this.watch = watch

		this.properties = {
			pip: {
				label: 'Instalar dependencias:',
				type: 'tags',
				description: 'Paquetes que se instalaran por pip',
				value: []
			},
			events: {
				label: 'Eventos a escuchar:',
				type: 'tags',
				description:
					'Evento que ejecutar una función dentro de python \n Se debe de colocar @sio.event seguido de la función a llamar, por ejemplo: \ndef fnNext(data): ',
				value: []
			},
			code: {
				label: 'Código',
				type: 'code',
				lang: ['python', 'Python'],
				value: ''
			},
			// La propiedad isTrigger permite indicar si es un nodo que se ejecuta al inicio de un flujo
			isTrigger: {
				label: 'Trazar registros de salida:',
				description:
					'Permite al nodo crear registros de salida individuales por cada ejecución. Si está desactivado, el nodo solo tomara el primer registro de salida.',
				type: 'switch',
				value: true
			}
		}
	}

	onCreate() {
		this.ui.inputs = []
		this.ui.inputs.push('input')
		for (const value of this.properties.events.value) {
			this.ui.inputs.push(value)
		}
	}

	async onExecute({
		inputData,
		dependency,
		files,
		serverInstance,
		context,
		outputData
	}) {
		const { spawn } = await dependency.getRequire('child_process')
		const { Server } = await dependency.getRequire('socket.io')

		try {
			if (inputData.input !== 'input') {
				const socket = context.getValue({ obj: 'socket' })
				if (socket) socket.emit(inputData.input, inputData.data)
				return
			}

			const url = `/python_${context.idNode}`
			console.log('PYTHON:', url)
			// const { start } = await import('../../../serverForm/server.js')
			// start({ endpoint: url })
			const io = new Server(serverInstance, {
				maxHttpBufferSize: 1e8,
				path: url + '/socket.io',
				cors: {
					credentials: true,
					origin: [url]
				}
			})
			if (context.isTest) {
				io.listen(serverInstance.port)
				// await new Promise((resolve) => setTimeout(() => { resolve(true) }, 2000))
			}
			const pythonFile = await files.create({
				fileName: `python_${context.idNode}.py`,
				file: this.properties.code.value,
				options: { rewrite: true }
			})
			const pwd = spawn('pip', [
				'install',
				'python-socketio[client]',
				...this.properties.pip.value
			])

			pwd.stderr.on('data', (data) => {
				console.log(`[pip] stderr: ${data}`)
			})

			pwd.on('close', (code) => {
				console.log(`[pip] child process exited with code ${code}`)
				// Al finalizar se inicia la ejecución python
				const pwd2 = spawn('python3', [
					'./horizonShare/plugins/nodes/processing/_python/init.py',
					'--configfile',
					pythonFile.dirFile,
					'--port',
					serverInstance.port,
					'--path',
					url + '/socket.io'
				])
				pwd2.stdout.on('data', (data) => {
					console.log(`[python] : ${data}`)
				})
				pwd2.stderr.on('data', (data) => {
					console.log(`[python] stderr: ${data}`)
				})
			})

			io.on('connection', async (socket) => {
				console.log('[python] connection', socket.id)
				// Inicializa los valors del formulario
				context.setValue({ obj: 'socket', value: socket })
				socket.on('client', (value) => {
					outputData('response', value)
				})
				socket.on('disconnect', () => {
					console.log('[python] disconnect', socket.id)
				})
			})
		} catch (error) {
			console.log(error)
			outputData('error', { error: error.toString() })
		}
	}
}
