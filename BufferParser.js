import UnderrunError from './errors'
import { TICK_TYPE, INCOMING } from './constants'

class BufferParser {
  constructor() {
    this._buffer = []
  }
  dequeue() {
    if (this._buffer.length === 0) throw new UnderrunError()
    return this._buffer.shift()
  }
  dequeueBool() {
    return !!parseInt(this.dequeue(), 10)
  }
  dequeueFloat() {
    return parseFloat(this.dequeue())
  }
  dequeueInt() {
    return parseInt(this.dequeue(), 10)
  }
  enqueue(tokens) {
    this._buffer = this._buffer.concat(tokens)
  }

  _restoreLastChunk(chunk) {
    this._buffer = this._buffer.concat(chunk)
  }

  process(cb = function(err, methodName) {}) {
    while (true) {
      let bufferSnapshot = this._buffer.slice()
      try {
        let responseCode = this.dequeueInt()
        let responseFunctionName = this._responseCodeToString(responseCode)
        cb(null, responseFunctionName)
      } catch (e) {
        if (!(e instanceof UnderrunError)) throw e
        this._restoreLastChunk(bufferSnapshot)
        return
      }
    }
  }

  _responseCodeToString(responseCode) {
    for (let key in INCOMING) {
      if (INCOMING[key] === value) {
        return key
      }
    }
    return TICK_TYPE.UNKNOWN
  }
}
export default BufferParser
