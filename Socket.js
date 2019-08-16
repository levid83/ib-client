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

  _onConnect() {
    this._connected = true
  }

  _onEnd() {
    this._connected = false
    this._firstReceived = true
  }

  connect(cb = function() {}) {
    this._socket.connect(this._options, cb)
  }

  disconnect() {
    this._socket.end()
  }

  isConnected() {
    return this._connected
  }

  _wrapSocket(socket) {
    return socket
      .on('close', hadError => {
        console.log('close ', hadError ? 'transtion error' : 'no transition error')
        this.emit('close', hadError)
      })
      .on('connect', () => this.emit('connect'))
      .on('data', data => this._onData(data))
      .on('drain', () => {
        console.log('drain event')
        this.emit('drain')
      })
      .on('end', () => {
        this._onEnd()
        console.log('end event')
        this.emit('end')
      })
      .on('error', err => {
        console.log('error', err)
        this.emit('error', err)
      })
      .on('ready', () => {
        this._onConnect()
        this.emit('ready')
      })
      .on('timeout', () => {
        console.log('timeout event')
        this.emit('timeout')
      })
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

  write(data, cb) {
    // flatten if needed
    let tokens = [data].reduce((prev, curr) => prev.concat(curr))
    // cast the boolean values to 0 or 1
    tokens = tokens.map((val, i) => {
      if (typeof val === 'boolean') return val ? 1 : 0
      return val
    })
    let message = tokens.join(EOL) + EOL
    this._socket.write(message, 'utf8', cb(message))
  }
}
