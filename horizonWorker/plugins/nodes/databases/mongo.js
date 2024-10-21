export default class {
	// ===============================================
	// Dependencias
	// ===============================================
	// #pk @synatic/noql
	// #pk mongodb
	// ===============================================
	constructor() {
		this.title = 'Mongo'
		this.desc = 'Permite realizar llamadas a mongo'
		this.icon = '󰌪'
		this.group = 'Base de Datos'
		this.color = '#ee7d22'

		// this.addProperty('msg', '')
		this.addInput('input')
		this.addOutput('response')
		this.addOutput('error')

		this.properties = {
			config: {
				label: 'Configuración',
				type: 'code',
				lang: ['json', 'Json'],
				value: `{
  "host": "localhost",
  "database": "test",
  "timeout": 30000
}`
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
		let client = null
		try {
			const SQLParser = await dependency.getRequire('@synatic/noql')
			const { MongoClient } = await dependency.getRequire('mongodb')

			const config = this.properties.config.value

			if (!validStore || !getStore()) {
				client = new MongoClient(config.host, {
					connectTimeoutMS: config.timeout * 1000
				})
				await client.connect()
				if (validStore) setStore(client)
			} else {
				client = getStore()
			}
			const db = client.db(config.database)
			const parsedSQL = SQLParser.parseSQL(this.properties.query.value)
			// console.log(parsedSQL)
			if (parsedSQL.type === 'query') {
				const data = await db
					.collection(parsedSQL.collection)
					.find(parsedSQL.query || {}, parsedSQL.projection || {})
					.limit(parsedSQL.limit || 50)
					.toArray()
				if (!validStore) client.close()
				outputData('response', data)
			} else if (parsedSQL.type === 'aggregate') {
				const data = await db
					.collection(parsedSQL.collections[0])
					.aggregate(parsedSQL.pipeline)
					.toArray()
				if (!validStore) client.close()
				outputData('response', data)
			}
		} catch (exp) {
			outputData('error', { error: exp.toString() })
		}
	}
}
