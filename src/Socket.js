import { Socket } from 'net'
import { EventEmitter } from 'events'

const EOL = '\0'

export default class extends EventEmitter {
  constructor(options = { host: null, port: null }) {
    super()
    this._options = options
    this._firstReceived = true
    this._socket = this._wrapSocket(new Socket())
    this._connected = false
    this._dataFragment = ''
  }

  onConnected(cb = () => {}) {
    this.on('connected', cb)
    return this
  }

  onResponse(cb = data => {}) {
    this.on('response-data', cb)
    return this
  }

  onServerData(cb = serverData => {}) {
    this.on('server', cb)
    return this
  }

  onError(cb = error => {}) {
    this.on('error', cb)
    return this
  }

  onClose(cb = () => {}) {
    this.on('close', cb)
    return this
  }

  connect(cb = function() {}) {
    this._socket.connect(this._options, cb)
    return this
  }

  disconnect() {
    this._socket.end()
  }

  isConnected() {
    return this._connected
  }

  write(data, cb) {
    // flatten if needed
    let tokens = [data].reduce((prev, curr) => prev.concat(curr))
    // cast the boolean values to 0 or 1
    tokens = tokens.map((val, i) => {
      if (typeof val === 'boolean') return val ? 1 : 0
      return val
    })
    let message = tokens.join(EOL) + EOL
    if (!this._socket.write(message, 'utf8')) {
      this._socket.once('drain', cb(message))
    } else {
      process.nextTick(cb(message))
    }
  }

  _wrapSocket(socket) {
    return socket
      .on('connect', () => {})
      .on('ready', () => this._onConnect())
      .on('data', data => this._onData(data))
      .on('error', error => this._onError(error))
      .on('end', () => this._onClose())
      .on('close', hadError => this._onClose(hadError))
      .on('timeout', () => {})
      .on('drain', () => () => {})
  }

  _onConnect() {
    this._connected = true
    this.emit('connected')
  }

  _onData(data) {
    let dataWithFragment = this._dataFragment + data.toString()

    let tokens = dataWithFragment.split(EOL)
    if (tokens[tokens.length - 1] !== '') this._dataFragment = tokens[tokens.length - 1]
    else this._dataFragment = ''

    tokens = tokens.slice(0, -1)
    if (this._firstReceived) {
      if (tokens[0] && tokens[1]) {
        this.emit('server', { serverVersion: parseInt(tokens[0], 10), connectionTime: tokens[1] })
        tokens = tokens.slice(2)
        this._firstReceived = false
      }
    }
    this.emit('response-data', tokens)
  }

  _onError(error) {
    this.emit('error', error)
  }

  _onClose(error = false) {
    this._connected = false
    this._firstReceived = true
    this.emit('close', error)
  }
}
