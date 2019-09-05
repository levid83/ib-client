import { flattenDeep } from 'lodash'

import { Socket } from 'net'
import { EventEmitter } from 'events'

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
    let tokens = flattenDeep(data)
    let buffer = Buffer.from(tokens)
    if (!this._socket.write(buffer)) {
      this._socket.once('drain', () => cb(buffer))
    } else {
      process.nextTick(() => cb(buffer))
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

  _shiftHeader(buffer) {
    let mask = 0xffffffff
    return (
      ((mask & buffer.shift()) << 24) |
      ((mask & buffer.shift()) << 16) |
      ((mask & buffer.shift()) << 8) |
      (mask & buffer.shift())
    )
  }

  _processBuffer(buffer) {
    let length = this._shiftHeader(buffer)
    this.emit('response-data', buffer.slice(0, length))
    if (buffer.length > length) this._processBuffer(buffer.slice(length))
  }

  _onData(data) {
    if (this._firstReceived) {
      this.emit('server', Array.from(data))
      this._firstReceived = false
    } else {
      this._processBuffer(Array.from(data))
    }
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
