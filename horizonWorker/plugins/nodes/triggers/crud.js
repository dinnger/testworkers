export default class {
	// ===============================================
	// Dependencias
	// ===============================================
	// #pk jsonwebtoken
	// #pk ajv
	// #pk ajv-formats
	// #pk ajv-i18n
	// #pk ajv-errors
	// ===============================================
	constructor() {
		this.title = 'Crud'
		this.desc = 'Permite realizar llamadas crud (create, read, update, delete)'
		this.icon = '󰘯'
		this.group = 'Triggers'
		this.color = '#3498DB'
		this.isTrigger = true

		this.addInput('input')
		this.addOutput('response:get')
		this.addOutput('error')

		this.properties = {
			url: {
				label: 'URL asignada:',
				type: 'box',
				value: '/'
			},
			endPoint: {
				label: 'Endpoint:',
				type: 'list',
				object: {
					type: {
						label: 'Tipo',
						type: 'options',
						size: 1,
						options: [
							{
								label: 'GET',
								value: 'get'
							},
							{
								label: 'POST',
								value: 'post'
							},
							{
								label: 'PATCH',
								value: 'patch'
							},
							{
								label: 'PUT',
								value: 'put'
							},
							{
								label: 'DELETE',
								value: 'delete'
							}
						]
					},
					url: {
						label: 'URL',
						type: 'string',
						value: '/',
						size: 2
					},
					validate: {
						label: 'Validación',
						type: 'options',
						description:
							'Selecciona la validación que deseas aplicar (recurso > validación por tabla)',
						size: 1,
						options: [
							{
								label: 'Sin validación',
								value: ''
							}
						]
					}
				},
				value: [
					{
						type: {
							value: 'get'
						},
						url: {
							value: '/:id'
						}
					}
				]
			},
			timeout: {
				label: 'Tiempo de espera (seg):',
				type: 'number',
				value: 50
			},
			security: {
				label: 'Seguridad:',
				type: 'options',
				options: [
					{
						label: 'Ninguna',
						value: 'null'
					},
					{
						label: 'Básico',
						value: 'basic'
					},
					{
						label: 'JWT Bearer',
						value: 'jwt'
					},
					{
						label: 'Bearer Token',
						value: 'bearer'
					}
				],
				value: 'null'
			},
			securityBasicUser: {
				label: 'Usuario',
				type: 'string',
				value: '',
				show: false
			},
			securityBasicPass: {
				label: 'Contraseña',
				type: 'string',
				value: '',
				show: false
			},
			securityBearerToken: {
				label: 'Token',
				type: 'string',
				value: '',
				show: false
			},
			securityJWTSecret: {
				label: 'Secreto',
				type: 'string',
				value: '',
				show: false
			}
		}
	}

	onCreate({ context, environment, fn }) {
		const resources = fn.getResourcesByType({ type: 'validate-table' })
		const options = [
			{ label: 'Sin validación', value: '' },
			...resources.map((resource) => {
				return {
					label: resource,
					value: resource
				}
			})
		]
		this.properties.endPoint.object.validate.options = options

		// methods
		this.ui.outputs = []
		for (const [index, endPoint] of this.properties.endPoint.value.entries()) {
			this.ui.outputs.push(`response:${endPoint.type.value}_${index}`)
		}
		this.ui.outputs.push('error')

		this.properties.securityBasicUser.show = false
		this.properties.securityBasicPass.show = false
		this.properties.securityBearerToken.show = false
		this.properties.securityJWTSecret.show = false

		if (this.properties.security.value === 'basic') {
			this.properties.securityBasicUser.show = true
			this.properties.securityBasicPass.show = true
		}
		if (this.properties.security.value === 'bearer') {
			this.properties.securityBearerToken.show = true
		}
		if (this.properties.security.value === 'jwt') {
			this.properties.securityJWTSecret.show = true
		}
		const base = context.properties.config?.router?.base
		const prefix = `/api/flow_${context.properties.id}`

		const pathUrl =
			environment.path_url.slice(-1) !== '/'
				? environment.path_url
				: environment.path_url.slice(0, -1)
		const url = `${environment.base_url}${pathUrl}${prefix}/`
		const urlProd = `( HOST )${base}/`
		this.properties.url.value = `
    <div class="grid " style="grid-template-columns: repeat(6, minmax(0, 1fr)); ">
      <div class="col-span-1"><strong>Desarrollo:</strong></div>
      <div style="grid-column:span 5 / span 1">${url}</div>
      <div style="grid-column:span 1 / span 1"><strong>Producción:</strong></div>
      <div style="grid-column:span 5 / span 5">${urlProd}</div>
    </div>`
	}

	async onExecute({
		app,
		context,
		execute,
		logger,
		environment,
		dependency,
		outputData,
		fn
	}) {
		const Ajv = await dependency.getRequire('ajv')
		const addFormats = await dependency.getRequire('ajv-formats')
		const ajvErrors = await dependency.getRequire('ajv-errors')
		const jwt = await dependency.getRequire('jsonwebtoken')
		try {
			const ajv = new Ajv({ allErrors: true })
			ajvErrors(ajv /*, {singleError: true} */)
			addFormats(ajv)
			// Se define el prefixo de la ruta (Si es subFlow se utiliza el id del padre)
			let base
			let prefix
			if (environment.isSubFlow) {
				base = environment.subFlowBase
				prefix = `/api/flow_${environment.subFlowParent}`
			} else {
				base = context.properties.value.config?.router?.base
				prefix = `/api/flow_${context.properties.value.id}`
			}
			const pathUrl =
				environment.path_url.slice(-1) !== '/'
					? environment.path_url
					: environment.path_url.slice(0, -1)
			const url = `${pathUrl}${environment.isDev ? prefix : base}/`

			const replaceMessage = (arr, item) => {
				const errorMessage = item.keyword === 'errorMessage'
				if (!errorMessage) {
					arr.push(item.instancePath.replace('/', '') + ' ' + item.message)
					return
				}

				for (const m of item.params.errors) {
					let val = Object.entries(m.params)
					if (Array.isArray(val)) val = val[0][1]
					arr.push(item.message.replace(/\$\$/g, val))
				}
			}

			const validate = async ({ name, data }) => {
				return new Promise((resolve, reject) => {
					const resource = fn.getResource({ type: 'validate-table', name })
					if (!resource) {
						return reject({ error: 'No se encontró la validación' })
					}
					const resourceData = resource.data
					const schema = {
						type: 'object',
						properties: {},
						required: resourceData.filter((f) => f.required).map((f) => f.name),
						additionalProperties: false,
						errorMessage: {
							'type:': 'El tipo del campo $$ no corresponde',
							required: 'El campo $$ es requerido.',
							additionalProperties: 'La propiedad $$ no esta definida.'
						}
					}

					for (const value of Object.values(resourceData)) {
						schema.properties[value.name] = {
							type: value.type
							// ...value.options
						}
					}

					const validate = ajv.compile(schema)
					const valid = validate(data)
					if (!valid) {
						const errors = []
						// localize.es(validate.errors)
						validate.errors.map((m) => replaceMessage(errors, m))
						// eslint-disable-next-line prefer-promise-reject-errors
						return reject({
							error: errors
						})
					}
					resolve(true)
				})
			}

			const listener = async ({ type, nameValidate, req, res, next }) => {
				const data = {
					headers: req.headers,
					params: req.params,
					query: req.query,
					body: req.body,
					files: req.files,
					method: req.method,
					endpoint: req.path,
					time: Date.now()
				}

				// Validar Seguridad
				if (this.properties.security.value === 'jwt') {
					// Validación de autenticación
					if (!data.headers?.authorization) {
						logger.error(
							{
								responseTime: this.properties.timeout.value * 1000,
								responseCode: 506
							},
							'Solicitud Timed Out'
						)
						return outputData(
							'error',
							{
								error: 'Autenticación fallida',
								responseTime: this.properties.timeout.value * 1000,
								responseCode: 506
							},
							{ req, res }
						)
					}

					await jwt.verify(
						data.headers.authorization.split(' ')[1],
						this.properties.securityJWTSecret.value,
						(err, decoded) => {
							if (err)
								return outputData(
									'error',
									{ error: err.toString() },
									{ req, res }
								)
							data.security = decoded
						}
					)
				}

				if (nameValidate && nameValidate !== '') {
					try {
						await validate({ name: nameValidate, data: req.body })
					} catch (err) {
						return outputData(
							'error',
							{ error: err?.error || err.toString() },
							{ req, res }
						)
					}
				}

				outputData(`response:${type}`, data, { req, res })
				if (context.disabled) next()

				// Timeout
				res.setTimeout(this.properties.timeout.value * 1000, () => {
					execute.stop()
					logger.error(
						{
							responseTime: this.properties.timeout.value * 1000,
							responseCode: 506
						},
						'Solicitud Timed Out'
					)
					res.status(506).send('Excedido el tiempo de respuesta')
				})
			}
			for (const [index, element] of this.properties.endPoint.value
				.filter((f) => f.type.value)
				.entries()) {
				const endpoint =
					element.url.value[0] === '/'
						? element.url.value.slice(1)
						: element.url.value
				console.log('WEBHOOK:', element.type.value, `${url}${endpoint}`)
				app[element.type.value](
					`${url}${endpoint}`,
					async (req, res, next) =>
						await listener({
							type: `${element.type.value}_${index}`,
							nameValidate: element.validate.value,
							req,
							res,
							next
						})
				)
			}
			// app[this.properties.type.value](url, (req, res, next)
		} catch (error) {
			console.log('🚀 ~ onExecute ~ error:', error)
			outputData('error', { error: error.toString() })
		}
	}
}
