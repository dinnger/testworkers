export default class {
  // ===============================================
  // Dependencias
  // ===============================================
  // ===============================================
  constructor () {
    this.title = 'Iteración'
    this.desc = 'Procesa elemento a elemento de una lista.'
    this.icon = '󱖈'
    this.group = 'Procesamiento'
    this.color = '#F39C12'
    this.addInput('input')
    this.addInput('add')
    this.addInput('next')
    this.addOutput('response')
    this.addOutput('finish')
    this.addOutput('error')
    this.properties = {
      valor: {
        label: 'Valor de la iteración:',
        type: 'code',
        lang: ['json', 'JSON'],
        value: ''
      },
      // La propiedad isTrigger permite indicar si es un nodo que se ejecuta al inicio de un flujo
      isTrigger: {
        label: 'Trazar registros de salida:',
        description: 'Permite al nodo crear registros de salida individuales por cada ejecución. Si está desactivado, el nodo solo tomara el primer registro de salida.',
        type: 'switch',
        show: false,
        value: true
      }
    }
  }

  async onExecute ({ inputData, storage, context, outputData }) {
    try {
      let valorInput = []
      try {
        valorInput = typeof this.properties.valor.value === 'object' && Array.isArray(this.properties.valor.value) ? this.properties.valor.value : JSON.parse(this.properties.valor.value)
      } catch (error) {}

      if (inputData.input === 'input' && valorInput.length === 0 && Array.isArray(inputData?.data)) valorInput = inputData.data

      if (!Array.isArray(valorInput)) return outputData('error', { error: 'El input debe ser un listado (Array)' })

      let next = storage.execute.get({ key: 'next' })
      let add = storage.execute.get({ key: 'add' })

      const loadFunction = () => {
        storage.execute.set({ key: 'index', value: 0 })
        storage.execute.set({ key: 'status', value: 'finish' })
        storage.execute.set({
          key: 'next',
          value: () => {
            if (valorInput.length === 0) {
              storage.execute.set({ key: 'status', value: 'finish' })
              return outputData('finish', valorInput)
            }
            storage.execute.set({ key: 'index', value: storage.execute.get({ key: 'index' }) + 1 })
            storage.execute.set({ key: 'status', value: 'active' })
            return outputData('response', { index: storage.execute.get({ key: 'index' }), value: valorInput.shift() })
          }
        })
        storage.execute.set({
          key: 'add',
          value: (value) => {
            const status = storage.execute.get({ key: 'status' })
            valorInput.push(value)
            if (status === 'finish') {
              storage.execute.set({ key: 'status', value: 'active' })
              return outputData('response', { index: storage.execute.get({ key: 'index' }) || 0, value: valorInput.shift() })
            }
          }
        })
      }

      if (!next) {
        loadFunction()
        next = storage.execute.get({ key: 'next' })
        add = storage.execute.get({ key: 'add' })
      }

      if (inputData.input === 'next' && next) return next()
      if (inputData.input === 'add' && add) return add(inputData.data)
      if (inputData.input === 'input') {
        loadFunction()
        return outputData('response', { index: storage.execute.get({ key: 'index' }) || 0, value: valorInput.shift() })
      }
    } catch (error) {
      console.log(error)
      outputData('error', { error: error.toString() })
    }
  }
}
