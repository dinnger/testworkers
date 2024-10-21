import { mime } from './_mimeTypes.js'
import { statusCode } from './_statusCodeTypes.js'
export default class {
	constructor() {
		this.title = 'Response'
		this.desc = 'Devuelve la respuesta de una llamada webhook'
		this.icon = '󰌑'
		this.color = '#F39C12'
		// this.addProperty('msg', '')
		this.addInput('input')
		this.addOutput('response')
		this.addOutput('error')

		this.properties = {
			// propiedadad content type
			contentType: {
				label: 'Content Type',
				type: 'options',
				description: 'Tipo de contenido de la respuesta',
				value: 'application/json',
				options: mime,
				size: 2,
				disabled: false
			},
			status: {
				label: 'Código:',
				type: 'options',
				value: 200,
				options: statusCode,
				size: 1
			},
			isFile: {
				label: 'Es Archivo:',
				type: 'switch',
				value: false,
				size: 1
			},
			nameFile: {
				label: 'Nombre Archivo (con extensión):',
				type: 'string',
				value: '',
				size: 4,
				show: false
			},
			response: {
				label: 'Respuesta',
				type: 'code',
				lang: ['json', 'Json'],
				value: '{\n}'
			},
			header: {
				label: 'Headers',
				type: 'code',
				lang: ['json', 'Json'],
				value: '{\n}',
				show: true
			}
		}
	}

	onCreate() {
		this.properties.nameFile.show = false
		this.properties.header.show = true
		this.properties.contentType.disabled = false

		if (this.properties.isFile.value) {
			this.properties.nameFile.show = true
			this.properties.header.show = false
			this.properties.contentType.value = 'application/octet-stream'
			this.properties.contentType.disabled = true
		}
	}

	onExecute({ context, logger, outputData }) {
		let node = null
		node = context.getNodeByType('triggers/webhook')
		if (!node) node = context.getNodeByType('triggers/crud')
		if (!node) node = context.getNodeByType('triggers/soap')
		if (!node) return outputData('error', { error: 'No se encontró el nodo' })
		const convertJson = (text) => {
			try {
				return JSON.parse(text)
			} catch (error) {
				return text
			}
		}

		try {
			const ifExecute = context.ifExecute()
			if (!ifExecute) {
				const response = this.properties.response.value
				logger.info(response)
				// agregar el content type a la respuesta node.meta.res proveniente de express
				const contentType = this.properties.contentType.value
				const headers = convertJson(this.properties.header.value)
				// Omitiendo si es test
				if (!context.isTest) {
					node.meta.res.set('Content-Type', contentType)
					Object.keys(headers).forEach((key) => {
						node.meta.res.set(key, headers[key])
					})
					if (this.properties.isFile.value) {
						node.meta.res.set(
							'Content-Disposition',
							`attachment; filename="${this.properties.nameFile.value}"`
						)
					}
					node.meta.res
						.status(parseInt(this.properties.status.value))
						.send(response)
				}
				return outputData('response', {
					statusCode: this.properties.status.value,
					response,
					contentType
				})
			}
		} catch (error) {
			console.log(error)
			outputData('error', { statusCode: 500, error: error.toString() })
			logger.error(
				{ responseTime: this.meta.accumulativeTime },
				error.toString()
			)
			if (
				node?.meta?.res &&
				error.toString().indexOf('ERR_HTTP_HEADERS_SENT') === -1
			)
				node.meta.res.status(500).send('Error en respuesta ')
		}
	}
}
