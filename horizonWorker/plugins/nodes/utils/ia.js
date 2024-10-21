export default class {
  // ===============================================
  // Dependencias
  // ===============================================
  // ===============================================
  constructor() {
    this.title = "IA";
    this.desc = "Procesa la solicitud en base a los datos ingresados.";
    this.icon = "󱚞";
    this.addInput("input");
    this.addOutput("response");
    this.addOutput("error");
    this.properties = {
      system: {
        label: "Instrucciones del sistema:",
        type: "string",
        value: "",
      },
      question: {
        label: "Pregunta del usuario:",
        type: "string",
        value: "",
      },
    };
  }

  async onExecute({ inputData, execution, context, outputData, dependency }) {
    try {
      const { GoogleGenerativeAI } = await dependency.getImport(
        "@google/generative-ai",
      );

      const genAI = new GoogleGenerativeAI(
        "AIzaSyAZ501aLKR_Hw-J44fnh9rUmh6eGGiTEXw",
      );
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest",
      });

      const chat = model.startChat({
        history: [
          {
            role: "user",
            parts: [{ text: this.properties.system.value }],
          },
          {
            role: "model",
            parts: [{ text: "Entendido, en que te puedo ayudar?" }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 2000,
        },
      });

      const result = await chat.sendMessage(
        this.properties.question.value.toString(),
      );

      outputData("response", { msg: result.response.text() });
    } catch (error) {
      outputData("error", { error: error.toString() });
    }
  }
}
