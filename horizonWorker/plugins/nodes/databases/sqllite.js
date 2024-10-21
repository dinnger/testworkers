import { config } from "dotenv";

export default class {
  // ===============================================
  // Dependencias
  // ===============================================
  // #pk pg
  // #pk pg-hstore
  // ===============================================
  constructor() {
    this.title = "SQLite";
    this.desc = "Permite realizar llamadas a SQLite";
    this.icon = "󰆼";
    this.group = "Base de Datos";
    this.color = "#ee7d22";

    this.addInput("input");
    this.addOutput("response");
    this.addOutput("error");

    this.properties = {
      config: {
        label: "Configuración",
        type: "code",
        lang: ["json", "Json"],
        value: `{\n  "databaseName": "test"\n}`,
      },
      query: {
        label: "Query:",
        type: "code",
        lang: ["sql", "sql"],
        value: "",
      },
    };
  }

  async onExecute({ dependency, context, outputData }) {
    const fs = await dependency.getRequire("fs");
    let sqlite3 = await dependency.getRequire("sqlite3");
    sqlite3 = sqlite3.verbose();

    const ownerAlias = context.properties?.value?.owner?.alias || null;
    if (!ownerAlias)
      return outputData("error", {
        error: "No se encontró el alias del usuario",
      });

    let pool = null;
    const path =
      `./_database/${ownerAlias}/` +
      (this.properties.config?.value?.databaseName || "test") +
      ".db";
    try {
      // if (!validStore || !getStore()) {
      if (!fs.existsSync(path))
        return outputData("error", {
          error: "No se encontró la base de datos " + path,
        });
      pool = new sqlite3.Database(path);
      // if (validStore) setStore(pool)
      // } else {
      //   pool = getStore()
      // }
      const query = this.properties.query.value;
      if (query.toUpperCase().indexOf("SELECT") >= 0) {
        await pool.all(query, (err, res) => {
          if (err) return outputData("error", { error: err.toString() });
          outputData("response", res);
        });
      } else {
        await pool.run(query, function (err, res) {
          if (err) return outputData("error", { error: err.toString() });
          if (this.lastID && this.lastID > 0)
            return outputData("response", { lastID: this.lastID });
          outputData("response", res);
        });
        // if (!validStore) pool.end()
      }
    } catch (err) {
      // if (!context.retry && validStore) return retryStore(this, { context, outputData })
      // if (validStore) deleteStore()
      // if (pool) pool.end()
      outputData("error", { error: err.toString() });
    }
  }
}
