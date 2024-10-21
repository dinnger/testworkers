export default class {
  constructor ({ ref, watch }) {
    this.title = 'Formulario'
    this.desc = 'Creación de formularios dinámicos'
    this.icon = '󰉪'
    this.autoInit = true
    this.addOutput('init')
    this.addOutput('error')

    this.ref = ref
    this.watch = watch

    this.properties = {
      endpoint: {
        label: 'Endpoint:',
        type: 'string',
        value: '/form',
        size: 2
      },
      url: {
        label: 'Formulario:',
        type: 'button',
        buttonLabel: 'Formulario',
        tooltip: 'Crear/Editar formulario:',
        click: ({ dynamicComponent }) => this.load({ el: this, dynamicComponent }),
        size: 2
      },
      code: {
        label: 'Código:',
        type: 'code',
        lang: ['json', 'Json'],
        disabled: true,
        changeValue: true,
        show: false,
        value: ''
      },
      variables: {
        label: 'Variables Iniciales:',
        lang: ['json', 'Json'],
        type: 'code',
        value: '{\n\n}'
      }
    }
  }

  load ({ el, dynamicComponent }) {
    const { setComponent, setComponentValue } = dynamicComponent
    setComponentValue(el.properties.code.value)
    setComponent('form')
  }

  async onCreate () {
    this.properties.code.value = this.ref(this.properties.code.value)

    const convertJson = (value) => {
      try {
        return JSON.parse(value)
      } catch (error) {
        return null
      }
    }

    const actions = (value) => {
      const data = convertJson(value)
      this.ui.outputs = []
      this.ui.outputs.push('init')
      if (data && data.actions) {
        this.ui.outputs.push(...data.actions.map(action => `action:${action}`))
      }
      this.ui.outputs.push('error')
    }

    actions(this.properties.code.value.value)
    // Se agregan todos los outputs del formulario
    this.watch(() => this.properties.code.value, value => {
      actions(value.value)
    },
    { deep: true })
  }

  async onExecute ({ server, dependency, serverInstance, files, context, outputData }) {
    const express = await dependency.getRequire('express')
    const path = await dependency.getRequire('path')
    const history = await dependency.getRequire('connect-history-api-fallback')
    const { Server } = await dependency.getRequire('socket.io')
    const __dirname = import.meta.dirname
    try {
      const base = context.properties.value.config?.router?.base
      const prefix = `/flow_${context.properties.value.id}`
      const pathUrl = context.environment.path_url.slice(-1) !== '/' ? context.environment.path_url : context.environment.path_url.slice(0, -1)
      const url = pathUrl + (context.environment.env === 'development' ? prefix : base) + this.properties.endpoint.value
      console.log('FORM:', url)

      const pathStatic = express.static(path.join(__dirname, './_server/dist'))
      server.use(url, pathStatic)
      server.use(url, history({ verbose: false }))

      const io = new Server(serverInstance, {
        maxHttpBufferSize: 1e8,
        path: url + '/socket.io',
        cors: {
          credentials: true,
          origin: [url]
        }
      })
      io.on('connection', async (socket) => {
        socket.emit('getModel', JSON.parse(this.properties.code.value))

        // Inicializa los valors del formulario
        outputData('init', {}, { socket })
        socket.emit('setValue', { variable: this.properties.variables.value })

        socket.on('action', (value) => {
          outputData(`action:${value.action}`, value.properties || {}, { socket })
        })

        socket.on('setLocalStorage', value => {
          try {
            context.properties.value.localStorage = JSON.parse(value.variable)
          } catch (error) {
            console.log(error)
          }
        })

        socket.on('disconnect', () => {
          console.log('>>>>>> disconnect', socket.id)
        })
      })
    } catch (error) {
      console.log(error)
    }
  }
}
