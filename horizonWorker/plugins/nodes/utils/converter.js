export default class {
  // ===============================================
  // Dependencias
  // ===============================================
  // #pk fast-xml-parser
  // ===============================================
  constructor ({ ref, watch }) {
    this.title = 'Conversión de Tipo'
    this.desc = 'Convierte un formato en otro'
    this.icon = '󰬳'
    this.color = '#F39C12'
    this.group = 'Procesamiento'
    this.addInput('input')
    this.addOutput('response')
    this.addOutput('error')
    this.ref = ref
    this.watch = watch
    this.properties = {
      type: {
        label: 'Tipo de conversión:',
        type: 'options',
        options: [
          {
            label: 'XML a JSON',
            value: 'xmlToJson'
          },
          {
            label: 'JSON a XML',
            value: 'jsonToXml'
          }
        ],
        value: ''
      },
      convertA: {
        label: 'Valor',
        type: 'string',
        show: false,
        value: ''
      }
    }
  }

  onCreate ({ context }) {
    this.properties.convertA.show = false

    if (this.properties.type.value === 'xmlToJson') {
      this.properties.convertA.show = true
    }
    if (this.properties.type.value === 'jsonToXml') {
      this.properties.convertA.show = true
    }
  }

  async onExecute ({ dependency, outputData }) {
    const { XMLParser, XMLBuilder } = await dependency.getRequire('fast-xml-parser')

    if (this.properties.type.value === 'xmlToJson') {
      try {
        const parser = new XMLParser()
        const jObj = parser.parse(this.properties.convertA.value)
        return outputData('response', jObj)
      } catch (error) {
        return outputData('error', error.toString())
      }
    }
    if (this.properties.type.value === 'jsonToXml') {
      try {
        const builder = new XMLBuilder({ format: true })
        const response = builder.build(this.properties.convertA.value)
        return outputData('response', response)
      } catch (error) {
        return outputData('error', error.toString())
      }
    }

    outputData('error', { error: 'Sin conversión' })
  }
}
