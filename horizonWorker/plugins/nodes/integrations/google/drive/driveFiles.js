import { mime } from "./_mimeTypes.js";

export default class {
  // ===============================================
  // Dependencias
  // ===============================================
  // #pk json-as-xlsx
  // #pk @json2csv/plainjs
  // ===============================================
  constructor({ ref, watch }) {
    this.title = "Archivo";
    this.desc = "Permite generar diferentes tipos de archivos";
    this.icon = "󰢪";
    this.group = "Integraciones/Drive";
    this.color = "#F39C12";

    this.addInput("input");
    this.addOutput("response");
    this.addOutput("error");

    this.ref = ref;
    this.watch = watch;

    this.properties = {
      type: {
        label: "Tipo de acción:",
        type: "options",
        options: [
          {
            label: "Crear",
            value: "create",
          },
          {
            label: "Eliminar",
            value: "delete",
          },
          {
            label: "Obtener",
            value: "get",
          },
        ],
        value: "create",
      },
      options: {
        label: "Hoja de Calculo:",
        type: "group",
        object: {
          contentType: {
            label: "Tipo de contenido:",
            type: "options",
            description: "Tipo de contenido de la respuesta",
            value: "application/json",
            options: mime,
            size: 2,
          },
        },
        value: [],
        show: true,
      },
    };
  }

  onCreate({ context }) {
    this.properties.options.show = false;
    this.properties.csv.show = false;

    if (this.properties.type.value === "xlsx") {
      this.properties.options.show = true;
    }
    if (this.properties.type.value === "csv") {
      this.properties.csv.show = true;
      // this.properties.options.show.value = true
    }
  }

  async onExecute({ context, outputData, dependency }) {
    const { google } = await dependency.getRequire("@googleapis");

    try {
      const oauth2Client = new google.auth.OAuth2(
        "YOUR_CLIENT_ID",
        "YOUR_CLIENT_SECRET",
        "YOUR_REDIRECT_URL",
      );

      // const client = await docs.docs({
      //   version: 'v1',
      //   auth: authClient
      // })

      const drive = google.drive({
        version: "v3",
        auth: oauth2Client,
      });

      const res = await drive.files.create({
        requestBody: {
          name: "Test",
          mimeType: "text/plain",
        },
        media: {
          mimeType: "text/plain",
          body: "Hello World",
        },
      });

      // const res = await drive.files.export({
      //   fileId: 'asxKJod9s79', // A Google Doc
      //   mimeType: 'application/pdf'
      // }, {
      //   // Make sure we get the binary data
      //   responseType: 'stream'
      // });
      console.log(res);
    } catch (err) {
      outputData("error", { error: err.toString() });
    }
  }
}
