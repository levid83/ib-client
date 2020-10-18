import Queue from 'better-queue'

export default class extends Queue {
  constructor(
    options = {
      eventHandler: null,
      socket: null,
      decoder: null
    }
  ) {
    super(function(message, cb) {
      const result = options.decoder.decodeMessage(message)
      if (Array.isArray(result)) {
        result.map(message => this._emitEvent(options.eventHandler, message))
      } else {
        this._emitEvent(options.eventHandler, result.message)
      }
      cb(null, true)
    })

    this._socket = options.socket
    this._eventHandler = options.eventHandler
    this._decoder = options.decoder

    this._socket.on('response-data', data => this.push(data))
    this._socket.on('server', this.onServerVersionData.bind(this))
  }

  _emitEvent(eventHandler, message) {
    if (message.params) {
      eventHandler.emit(message.message, ...message.params)
    } else {
      eventHandler.emit(message.message)
    }
  }

  onServerVersionData(data) {
    let version = this._decoder.decodeServerVersion(data)
    this._eventHandler.emit('server', version)
  }
}
