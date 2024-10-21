export default class {
  // ===============================================
  // Dependencias
  // ===============================================
  // #pk cron
  // ===============================================
  constructor({ ref, watch }) {
    this.title = "Timer";
    this.desc = "Temporizador de tiempo.";
    this.icon = "󰔟";
    this.ref = ref;
    this.watch = watch;
    this.isTrigger = true;

    this.addInput("input");
    this.addOutput("tick", 0);
    this.properties = {
      cron: {
        label: "Configuración de cron:",
        type: "string",
        value: "*/10 * * * * *",
      },
      timezone: {
        label: "Zona horaria:",
        type: "string",
        value: "America/Guatemala",
      },
      response: {
        label: "Tipo de respuesta:",
        type: "options",
        options: [
          {
            label: "Texto",
            value: "text",
          },
          {
            label: "Contador",
            value: "count",
          },
        ],
        value: "text",
      },
      data: {
        label: "Salida",
        type: "string",
        value: "tick!",
        show: false,
      },
      countInit: {
        label: "Valor Inicial",
        type: "number",
        value: 0,
        show: false,
      },
      countMax: {
        label: "Valor Máximo",
        type: "number",
        value: null,
        show: false,
      },
      countInterval: {
        label: "Intervalo",
        type: "number",
        value: 1,
        show: false,
      },
    };
  }

  onCreate({ context }) {
    const response = this.properties.response.value;
    this.properties.data.show = false;
    this.properties.countInit.show = false;
    this.properties.countMax.show = false;
    this.properties.countInterval.show = false;
    if (response === "text") {
      this.properties.data.show = true;
    }
    if (response === "count") {
      this.properties.countInit.show = true;
      this.properties.countMax.show = true;
      this.properties.countInterval.show = true;
    }
  }

  async onExecute({ outputData, dependency }) {
    let temporalCount = this.properties.countInit.value || 0;
    try {
      const { CronJob } = await dependency.getImport("cron");
      const job = new CronJob(
        this.properties.cron.value, // cronTime
        () => {
          if (this.properties.response.value === "text") {
            outputData("tick", this.properties.data.value);
          }
          if (this.properties.response.value === "count") {
            outputData("tick", temporalCount);
            temporalCount += this.properties.countInterval.value;
            if (this.properties.countMax.value !== 0) {
              if (
                this.properties.countMax.value < 0 &&
                temporalCount <= this.properties.countMax.value
              ) {
                job.stop();
              }
              if (
                this.properties.countMax.value > 0 &&
                temporalCount >= this.properties.countMax.value
              ) {
                job.stop();
              }
            }
          }
        }, // onTick
        null, // onComplete
        true, // start
        this.properties.timezone.value, // timeZone
      );
    } catch (error) {
      console.log(error.toString());
    }
  }
}
