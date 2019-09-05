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
      options.decoder.decodeMessage(message)
      cb(null, true)
    })

    this._socket = options.socket
    this._eventHandler = options.eventHandler
    this._decoder = options.decoder

    this._socket.on('response-data', data => this.push(data))
    this._socket.on('server', this.onServerVersionData.bind(this))
  }

  onServerVersionData(data) {
    let version = this._decoder.decodeServerVersion(data)
    this._eventHandler.emit('server', version)
  }
}
