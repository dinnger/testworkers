export default class {
  // ===============================================
  // Dependencias
  // ===============================================
  // #pk crypto-js
  // #pk bcrypt
  // #pk jsonwebtoken
  // ===============================================
  constructor({ ref, watch }) {
    this.title = "Cifrado";
    this.desc = "Permite encriptar o desencriptar";
    this.icon = "󱜦";
    this.addInput("input");
    this.addOutput("response");
    this.addOutput("error");
    this.ref = ref;
    this.watch = watch;
    this.properties = {
      type: {
        label: "Tipo de utilidad:",
        type: "options",
        options: [
          {
            label: "Generador Bcrypt",
            value: "encriptBcrypt",
          },
          {
            label: "Validador Bcrypt",
            value: "validBcrypt",
          },
          {
            label: "Generador JWT",
            value: "encriptJWT",
          },
          {
            label: "Validador JWT",
            value: "validJWT",
          },
          {
            label: "Cifrado con llave",
            value: "encrypt",
          },
          {
            label: "Descifrado con llave",
            value: "decrypt",
          },
        ],
        value: "",
      },
      encriptBcrypt: {
        label: "Valor a encriptar:",
        type: "string",
        show: false,
        value: "",
      },
      validBcryptOrigen: {
        label: "Bcrypt origen:",
        type: "string",
        show: false,
        value: "",
      },
      validBcryptValid: {
        label: "Valor a validar:",
        type: "string",
        show: false,
        value: "",
      },
      encriptJWT: {
        label: "Valor a encriptar (json):",
        type: "code",
        lang: ["json", "Json"],
        show: false,
        value: "{\n}",
      },
      encriptJWTValue: {
        label: "Token a validar:",
        type: "string",
        show: false,
        value: "",
      },
      encriptJWTSecret: {
        label: "Secreto:",
        type: "string",
        show: false,
        value: "",
      },
      encriptJWTExpiresIn: {
        label: "Tiempo de expiración (Horas):",
        type: "number",
        show: false,
        value: 12,
      },
      encriptValue: {
        label: "Valor a cifrar/descifrar (json):",
        type: "string",
        show: false,
        value: "",
      },
      encriptKey: {
        label: "Palabra clave",
        type: "string",
        show: false,
        value: "",
      },
    };
  }

  onCreate({ context }) {
    this.properties.encriptBcrypt.show = false;
    this.properties.validBcryptOrigen.show = false;
    this.properties.validBcryptValid.show = false;
    this.properties.encriptJWT.show = false;
    this.properties.encriptJWTValue.show = false;
    this.properties.encriptJWTSecret.show = false;
    this.properties.encriptJWTExpiresIn.show = false;
    this.properties.encriptValue.show = false;
    this.properties.encriptKey.show = false;

    if (this.properties.type.value === "encriptBcrypt") {
      this.properties.encriptBcrypt.show = true;
    }
    if (this.properties.type.value === "validBcrypt") {
      this.properties.validBcryptOrigen.show = true;
      this.properties.validBcryptValid.show = true;
    }
    if (this.properties.type.value === "encriptJWT") {
      this.properties.encriptJWT.show = true;
      this.properties.encriptJWTSecret.show = true;
      this.properties.encriptJWTExpiresIn.show = true;
    }
    if (this.properties.type.value === "validJWT") {
      this.properties.encriptJWTValue.show = true;
      this.properties.encriptJWTSecret.show = true;
    }
    if (this.properties.type.value === "encrypt") {
      this.properties.encriptValue.show = true;
      this.properties.encriptKey.show = true;
    }
    if (this.properties.type.value === "decrypt") {
      this.properties.encriptValue.show = true;
      this.properties.encriptKey.show = true;
    }
  }

  async onExecute({ outputData, dependency }) {
    try {
      if (this.properties.type.value === "encriptBcrypt") {
        const bcrypt = await dependency.getRequire("bcrypt");
        const saltRounds = 10;
        const hash = bcrypt.hashSync(
          this.properties.encriptBcrypt.value,
          saltRounds,
        );
        return outputData("response", { hash });
      }
      if (this.properties.type.value === "validBcrypt") {
        const bcrypt = await dependency.getRequire("bcrypt");
        const valid = bcrypt.compareSync(
          this.properties.validBcryptValid.value,
          this.properties.validBcryptOrigen.value,
        );
        return outputData("response", { valid });
      }
      if (this.properties.type.value === "encriptJWT") {
        const jwt = await dependency.getRequire("jsonwebtoken");
        const encriptJWT = this.properties.encriptJWT.value;
        const hash = jwt.sign(
          typeof encriptJWT === "string" ? JSON.parse(encriptJWT) : encriptJWT,
          this.properties.encriptJWTSecret.value,
          { expiresIn: this.properties.encriptJWTExpiresIn.value * 60 * 60 },
        );
        return outputData("response", { hash });
      }
      if (this.properties.type.value === "validJWT") {
        const jwt = await dependency.getRequire("jsonwebtoken");
        const val = jwt.verify(
          this.properties.encriptJWTValue.value,
          this.properties.encriptJWTSecret.value,
        );
        return outputData("response", val);
      }
      if (this.properties.type.value === "encrypt") {
        const CryptoJS = await dependency.getRequire("crypto-js");
        const text =
          typeof this.properties.encriptValue.value === "object"
            ? JSON.stringify(this.properties.encriptValue.value)
            : this.properties.encriptValue.value;
        const val = CryptoJS.AES.encrypt(
          text,
          this.properties.encriptKey.value,
        ).toString();
        console.log(val);
        return outputData("response", val);
      }
      if (this.properties.type.value === "decrypt") {
        const CryptoJS = await dependency.getRequire("crypto-js");
        const bytes = CryptoJS.AES.decrypt(
          this.properties.encriptValue.value,
          this.properties.encriptKey.value,
        );
        const val = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        return outputData("response", val);
      }
    } catch (error) {
      outputData("error", { error: error.toString() });
    }
  }
}
