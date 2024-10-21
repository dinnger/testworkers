export default class {
	// ===============================================
	// Dependencias
	// ===============================================
	// #pk pg
	// #pk pg-hstore
	// ===============================================
	constructor() {
		this.title = 'Postgres'
		this.desc = 'Permite realizar llamadas a postgres'
		this.icon = '󰆼'
		this.group = 'Base de Datos'
		this.color = '#ee7d22'

		this.addInput('input')
		this.addOutput('response')
		this.addOutput('error')

		this.properties = {
			config: {
				label: 'Configuración',
				type: 'code',
				lang: ['json', 'Json'],
				value: `{\n  "host": "localhost",\n  "user": "postgres",\n  "password": "postgres",\n  "database": "postgres", \n  "port": 5432,\n  "connectionTimeout": 30000\n}`
			},
			query: {
				label: 'Query:',
				type: 'code',
				lang: ['sql', 'sql'],
				value: ''
			}
		}
	}

	async onExecute({ outputData, dependency }) {
		const { Pool } = await dependency.getRequire('pg')
		let poolConnect = null
		try {
			const config = JSON.parse(this.properties.config.value)
			poolConnect = new Pool(config)
			const res = await poolConnect.query(this.properties.query.value)
			poolConnect.end()
			outputData('response', res.rows || res.map((m) => m.rows))
		} catch (err) {
			if (poolConnect) poolConnect.end()
			outputData('error', { error: err.toString().replace(/"/g, "'") })
		}
	}
}
