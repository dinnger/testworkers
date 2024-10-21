export default class {
	// ===============================================
	// Dependencias
	// ===============================================
	// #pk jsonwebtoken
	// ===============================================
	constructor({ ref, watch }) {
		this.title = 'Webhook'
		this.desc = 'Call webhook'
		this.icon = '󰘯'
		this.group = 'Triggers'
		this.color = '#3498DB'
		this.isTrigger = true

		this.addInput('input')
		this.addOutput('response')
		this.addOutput('error')

		this.ref = ref
		this.watch = watch

		this.properties = {
			url: {
				label: 'URL asignada:',
				type: 'box',
				value: '/'
			},
			endpoint: {
				label: 'Endpoint:',
				type: 'string',
				value: '/'
			},
			type: {
				label: 'Tipo de llamada:',
				type: 'options',
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
				],
				value: 'get'
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
		let endpoint = fn.mask({
			text: this.properties.endpoint.value,
			prefix: '<b class="text-[#E67E22]">',
			suffix: '</b>'
		})
		if (endpoint[0] === '/') endpoint = endpoint.slice(1)
		const pathUrl =
			environment.path_url.slice(-1) !== '/'
				? environment.path_url
				: environment.path_url.slice(0, -1)
		const url = environment.base_url + pathUrl + (prefix + '/' + endpoint)
		const urlProd = '( HOST )' + (base + '/' + endpoint)
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
		outputData
	}) {
		const jwt = await dependency.getRequire('jsonwebtoken')
		try {
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
			const endpoint =
				this.properties.endpoint.value[0] === '/'
					? this.properties.endpoint.value.slice(1)
					: this.properties.endpoint.value
			const url = pathUrl + (environment.isDev ? prefix : base) + '/' + endpoint

			console.log('WEBHOOK:', this.properties.type.value, url)

			app[this.properties.type.value](url, (req, res, next) => {
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

					jwt.verify(
						data.headers.authorization.split(' ')[1],
						this.properties.securityJWTSecret.value,
						function (err, decoded) {
							if (err)
								return outputData(
									'error',
									{ error: err.toString() },
									{ req, res }
								)
							data.security = decoded
							outputData('response', data, { req, res })
						}
					)
				} else {
					outputData('response', data, { req, res })
					if (context.disabled) next()
				}

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
			})
		} catch (error) {
			console.log('🚀 ~ onExecute ~ error:', error)
			outputData('error', { error: error.toString() })
		}
	}
}
