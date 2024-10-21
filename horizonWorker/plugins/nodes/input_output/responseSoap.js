export default class {
  // ===============================================
  // Dependencias
  // ===============================================
  // #pk fast-xml-parser
  // ===============================================
  constructor() {
    this.title = "Response Soap";
    this.desc = "Devuelve la respuesta de una llamada soap";
    this.icon = "󰌑";
    // this.addProperty('msg', '')
    this.addInput("input");
    this.properties = {
      status: {
        label: "Código de Respuesta:",
        type: "string",
        value: 200,
      },
      response: {
        label: "Respuesta",
        type: "code",
        lang: ["json", "Json"],
        value: "{\n}",
      },
    };
  }

  async onExecute({ context, outputData, dependency }) {
    let node = null;
    node = context.getNodeByType("input_output/soap");
    if (node === null) node = context.getNodeByType("input_output/webhook");

    try {
      const ifExecute = context.ifExecute();
      if (!ifExecute) {
        const type = typeof this.properties.response.value;
        let response = "";
        if (type === "object") {
          const { XMLBuilder } = await dependency.getRequire("fast-xml-parser");
          const builder = new XMLBuilder({ format: true });
          response = builder.build(this.properties.response.value);
        } else {
          response = this.properties.response.value;
        }

        context.logger.info(
          { responseTime: this.meta.accumulativeTime },
          response,
        );
        node.meta.res
          .status(parseInt(this.properties.status.value))
          .send(response);
      }
      outputData("response", {
        status: parseInt(this.properties.status.value),
      });
    } catch (error) {
      context.logger.error(
        { responseTime: this.meta.accumulativeTime },
        error.toString(),
      );
      if (node?.meta?.res) node.meta.res.status(500).send("Error en respuesta");
    }
  }
}
