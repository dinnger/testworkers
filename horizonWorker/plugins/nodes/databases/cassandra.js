export default class {
  // ===============================================
  // Dependencias
  // ===============================================
  // #pre RUN apt-get update
  // #pre RUN apt-get install default-jdk -y
  //
  // #pk cassandra-driver
  // ===============================================
  constructor() {
    this.title = "Cassandra";
    this.desc = "Permite realizar llamadas a Cassandra";
    this.icon = "󰆼";
    this.group = "Base de Datos";
    this.color = "#ee7d22";

    this.addInput("input");
    this.addOutput("response");
    this.addOutput("error");

    this.properties = {
      host: {
        label: "Host:",
        type: "string",
        value: "localhost",
      },
      user: {
        label: "Usuario:",
        type: "string",
        value: "cassandra",
      },
      password: {
        label: "Contraseña:",
        type: "string",
        value: "cassandra",
      },
      dataCenter: {
        label: "Centro de datos:",
        type: "string",
        value: "datacenter1",
      },
      keyspace: {
        label: "Keyspace:",
        type: "string",
        value: "keyspace1",
      },
      timeout: {
        label: "Tiempo de conexión (seg):",
        type: "number",
        value: 30,
      },
    };
  }

  async onCreate() {
    this.orm.onCreateORM();
  }

  async onExecute({ context, outputData, dependency }) {
    let client = null;
    try {
      const cassandra = await dependency.getRequire("cassandra-driver");
      const authProvider = new cassandra.auth.PlainTextAuthProvider(
        config.user,
        config.password,
      );
      client = new cassandra.Client({
        contactPoints: config.host.split(","),
        localDataCenter: config.dataCenter,
        authProvider,
        policies: {
          loadBalancing:
            new cassandra.policies.loadBalancing.DCAwareRoundRobinPolicy(
              config.dataCenter,
              3,
            ),
          RetryPolicy: 3,
        },
        keyspace: config.keyspace,
      });
      if (validStore) setStore(client);

      await client
        .execute(this.properties.query.value)
        .then((result) => {
          outputData("response", result.rows);
        })
        .catch((error) => {
          outputData("error", { error: error.toString() });
        });
    } catch (error) {
      outputData("error", { error: error.toString() });
    }
  }
}
