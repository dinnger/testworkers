export default class {
  // ===============================================
  // Dependencias
  // ===============================================
  // ===============================================
  constructor({ ref, watch }) {
    this.title = "Storage";
    this.desc =
      "Lectura/Escritura de valores en almacenamiento local o por archivo";
    this.icon = "󱈎";

    // this.addProperty('msg', '')
    this.addInput("input");
    this.addOutput("response");
    this.addOutput("error");
    this.ref = ref;
    this.watch = watch;
    this.properties = {
      type: {
        label: "Tipo de almacenamiento:",
        type: "options",
        options: [
          {
            label: "Físico",
            value: "physical",
          },
          {
            label: "Local",
            value: "local",
          },
          {
            label: "por Ejecución",
            value: "execution",
          },
        ],
        value: "local",
      },
      optionStorage: {
        type: "group",
        show: true,
        object: {
          action: {
            label: "Acción:",
            type: "options",
            options: [
              {
                label: "Sobrescribir",
                value: "overwrite",
              },
              {
                label: "Escribir si no existe",
                value: "ifNotExist",
              },
              {
                label: "Escribir al final",
                value: "push",
              },
              {
                label: "Solo Lectura",
                value: "readOnly",
              },
            ],
            value: "overwrite",
          },
          path: {
            label: "Ruta del Archivo",
            type: "string",
            value: "",
            show: false,
          },
          name: {
            label: "Nombre de la variable",
            type: "string",
            value: "",
          },
          body: {
            label: "Registro",
            type: "code",
            lang: ["json", "JSON"],
            value: "",
          },
        },
      },
      optionMemory: {
        type: "group",
        show: false,
        object: {
          action: {
            label: "Acción:",
            type: "options",
            options: [
              {
                label: "Sobrescribir",
                value: "overwrite",
              },
              {
                label: "Escribir al final (Array push)",
                value: "push",
              },
            ],
            value: "overwrite",
          },
          body: {
            label: "Registro",
            type: "code",
            lang: ["json", "JSON"],
            value: "",
          },
        },
      },
    };
  }

  isJsonString(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return str;
    }
  }

  async onCreate({ context }) {
    this.properties.optionStorage.show = false;
    this.properties.optionMemory.show = false;
    this.properties.optionStorage.object.path.show = false;
    this.ui.inputs = ["input"];

    if (["local", "physical"].indexOf(this.properties.type.value.value) > -1) {
      if (this.properties.type.value === "physical")
        this.properties.optionStorage.object.path.show = true;
      this.properties.optionStorage.show = true;
    }
    if (this.properties.type.value === "execution") {
      this.ui.inputs = ["input", "finish"];
      this.properties.optionMemory.show = true;
    }
  }

  async onExecute({ inputData, context, execution, outputData, dependency }) {
    try {
      const fs = await dependency.getImport("fs");
      let bodyData = "";
      bodyData = null;

      if (this.properties.type.value === "physical") {
        const action = this.properties.optionStorage.value.action.value;
        const path =
          this.properties.optionStorage.value.path.value +
          "/" +
          this.properties.optionStorage.value.name.value +
          ".storage";

        if (action === "ifNotExist") {
          if (fs.existsSync(path)) {
            return outputData(
              "response",
              this.isJsonString(fs.readFileSync(path, "utf-8")),
            );
          }
        }
        if (action === "overwrite" || action === "ifNotExist") {
          fs.writeFileSync(
            path,
            typeof bodyData === "object" ? JSON.stringify(bodyData) : bodyData,
          );
          outputData("response", bodyData);
        }
        if (action === "readOnly") {
          outputData(
            "response",
            this.isJsonString(fs.readFileSync(path, "utf-8")),
          );
        }
      }

      if (this.properties.type.value === "local") {
        const action = this.properties.optionStorage.value.action.value;
        if (action === "ifNotExist") {
          const store = context.getStore("localStore");
          if (store === null)
            context.setStore(
              "localStore",
              this.properties.optionStorage.value.name.value,
            );
          return outputData("response", { response: "ok" });
        }
        if (action === "overwrite" || action === "ifNotExist") {
          context.setStore(
            "localStore",
            this.properties.optionStorage.value.name.value,
          );
          outputData("response", { response: "ok" });
        }
        if (action === "push") {
          const store = context.getStore("localStore") || [];
          store.push(this.properties.optionStorage.value.body.value);
          context.setStore("localStore", store);
          outputData("response", { response: "ok" });
        }
        if (action === "readOnly") {
          const store = context.getStore("localStore") || [];
          outputData("response", store);
        }
      }

      if (this.properties.type.value === "execution") {
        const action = this.properties.optionMemory.value.action.value;
        if (action === "overwrite" || action === "ifNotExist") {
          execution.setStore("localStore", this.properties.name.value);
          outputData("response", { response: "ok" });
        }
        if (action === "push") {
          const store = execution.getStore("localStore") || [];
          if (inputData.input !== "finish") {
            store.push(this.properties.optionMemory.value.body.value);
            execution.setStore("localStore", store);
            // console.log(inputData)
          } else {
            outputData("response", store);
          }
        }
      }
    } catch (error) {
      outputData("error", { error: error.toString() });
    }
  }
}
