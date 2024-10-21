export default class {
  constructor({ ref, watch }) {
    this.title = 'Sub Flujo'
    this.desc = 'Permite enlazar un flujo existente'
    this.icon = '󱘖'
    this.color = '#F39C12'
    this.ref = ref
    this.watch = watch
    this.isTrigger = true

    this.addInput('input')
    this.addOutput('response')
    this.addOutput('error')

    this.properties = {
      flowName: {
        label: 'Link Flujo:',
        type: 'box',
        value: ''
      },
      flow: {
        label: 'Seleccionar flujo:',
        type: 'options',
        options: [],
        value: ''
      },
      node: {
        label: 'Seleccionar nodo:',
        type: 'options',
        options: [],
        value: ''
      },
      data: {
        label: 'Datos a enviar',
        type: 'code',
        lang: ['json', 'JSON'],
        value: '{{input.data}}'
      }
    }
  }

  async onCreate({ context, fieldChange, fn }) {
    const changeFlow = fieldChange.find(f => f === 'flow')
    const changeNode = fieldChange.find(f => f === 'node')

    const reloadNodes = async (idFlow) => {
      //
      const nodes = await fn.getFlowsNodes({ idFlow, type: 'triggers/init' })
      this.properties.node.options = nodes.map(m => {
        return {
          label: m.title,
          value: m.id,
          properties: m.properties
        }
      })
    }

    if (changeFlow) {
      this.properties.node.value = null
      this.properties.flowName.value = 'No se ha definido el flujo'
      return await reloadNodes(this.properties.flow.value)
    }

    if (changeNode) {
      const properties = this.properties.node.options.find(f => f.value === this.properties.node.value)?.properties
      if (!properties) {
        this.properties.data.value = '{/n}'
        return
      }
      this.properties.data.value = properties.schema.value
      return
    }

    const arr = await fn.getFlowsList()
    this.properties.flow.options = arr.map(m => {
      return {
        label: m.namespace.replace(/\./g, '/') + '/' + m.name,
        value: m.id
      }
    })
    const flow = arr.find(f => f.id === this.properties.flow.value)
    if (flow) {
      const url = '../flows/' + flow.id
      this.properties.flowName.value = `<a target='_blank' href="${url}" ><span class="mdi mdi-link-variant"></span>${flow.namespace.replace(/\./g, '/')}/${flow.name}</a>`
    }
    if (this.properties.flow.value) reloadNodes(this.properties.flow.value)

    // ---------------------------------------------------------------------------------
    // ------------------------------------- Watch -------------------------------------
    // ---------------------------------------------------------------------------------
    // this.watch(this.properties.flow.value, async (value) => {
    //   this.properties.node.value = null

    //   reloadNodes(value)
    // })

    // this.watch(this.properties.node.value, async (value) => {
    //   const val = this.properties.node.options.value.find(f => f.value === value)
    //   if (val?.properties?.valueDefault) {
    //     try {
    //       this.properties.data.value = JSON.parse(val.properties.valueDefault.value)
    //     } catch (error) {
    //       this.properties.data.value = '{/n}'
    //     }
    //   }
    // })
  }

  async onExecute({ inputData, context, outputData }) {
    try {
      const idSubFlow = this.properties.flow.value
      const idNode = this.properties.node.value

      const convertToJson = (text) => {
        try {
          return JSON.parse(text)
        } catch (error) {
          return text
        }
      }

      // Ejecutando de subflujo
      context.subFlow({
        idFlow: context.properties.value.id,
        idSubFlow,
        idNode,
        data: convertToJson(this.properties.data.value),
        outputData,
        outputDefault: 'response'
      })
    } catch (error) {
      outputData('error', { error: error.toString() })
    }
  }
}
