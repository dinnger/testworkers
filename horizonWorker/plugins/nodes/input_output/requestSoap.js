export default class {
  // ===============================================
  // Dependencias
  // ===============================================
  // #pk fast-xml-parser
  // ===============================================
  constructor() {
    this.title = "Request Soap";
    this.desc = "Realiza peticiones SOAP";
    this.icon = "󱌑";
    // this.addProperty('msg', '')
    this.addInput("input");
    this.addOutput("response");
    this.addOutput("error");

    this.properties = {
      url: {
        label: "Dirección URL:",
        type: "string",
        value: "",
      },
      headers: {
        label: "Headers",
        type: "code",
        lang: ["json", "Json"],
        value: "{\n}",
      },
      body: {
        label: "Body",
        type: "code",
        lang: ["xml", "XML"],
        value: "",
      },
    };
  }

  async onExecute({ outputData, dependency }) {
    const axios = await dependency.getRequire("axios");
    const { XMLParser } = await dependency.getRequire("fast-xml-parser");

    try {
      const config = {
        headers: {
          "Content-Type": "text/xml",
        },
      };
      if (this.properties.headers.value !== "") {
        config.headers = {
          ...config.headers,
          ...JSON.parse(this.properties.headers.value),
        };
      }

      axios
        .post(this.properties.url.value, this.properties.body.value, config)
        .then((response) => {
          if (typeof response.data === "object")
            return outputData("response", response.data);

          const parser = new XMLParser();
          const jObj = parser.parse(response.data);
          outputData("response", jObj);
        })
        .catch((error) => {
          console.log(error.toString());
          outputData(
            "error",
            error.response?.data || { message: error.message },
          );
        });
    } catch (error) {
      outputData("error", error.toString());
    }
  }
}
