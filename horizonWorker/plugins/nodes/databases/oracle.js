export default class {
	// ===============================================
	// Dependencias
	// ===============================================
	// #pre RUN apt-get update
	// #pre RUN apt-get install wget -y
	// #pre RUN apt-get install zip unzip -y
	// #pre RUN wget https://download.oracle.com/otn_software/linux/instantclient/1919000/instantclient-basiclite-linux.x64-19.19.0.0.0dbru.el9.zip
	// #pre RUN unzip instantclient-basiclite-linux.x64-19.19.0.0.0dbru.el9.zip
	// #pre RUN rm instantclient-basiclite-linux.x64-19.19.0.0.0dbru.el9.zip
	// #pre RUN apt-get install libaio1 -y
	// #pre RUN apt-get install lsof -y
	//
	// #pk oracledb
	// ===============================================
	constructor() {
		this.title = 'Oracle'
		this.desc = 'Permite realizar llamadas a oracle'
		this.icon = '󰆼'
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
  "connectionString": "localhost/xe",
  "user": "oracle",
  "password": "oracle",
  "timeout": 30
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

	// async onCreate () {
	//   this.orm.onCreateORM()
	// }

	async onExecute({ dependency, outputData, context }) {
		const oracledb = await dependency.getRequire('oracledb')
		let db = null
		try {
			oracledb.autoCommit = true
			oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
			db = await oracledb.getConnection(this.properties.config.value)
			db.callTimeout = timeout * 1000
			const rs = await db.execute(this.properties.query.value, [])
			const data = rs.rows
			db.close()
			outputData('response', data)
		} catch (err) {
			if (db) db.close()
			outputData('error', err.toString())
		}
	}
}
