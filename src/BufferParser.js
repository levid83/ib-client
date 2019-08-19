import UnderrunError from './errors'
import { TICK_TYPE, INCOMING } from './constants'

class BufferParser {
  constructor() {
    this._buffer = []
  }
  readAndShift() {
    if (this._buffer.length === 0) throw new UnderrunError()
    return this._buffer.shift()
  }
  readAndShiftBool() {
    return !!parseInt(this.readAndShift(), 10)
  }
  readAndShiftFloat() {
    return parseFloat(this.readAndShift())
  }
  readAndShiftInt() {
    return parseInt(this.readAndShift(), 10)
  }
  write(tokens) {
    this._buffer = this._buffer.concat(tokens)
  }

  _restoreLastChunk(chunk) {
    this._buffer = this._buffer.concat(chunk)
  }

  process(cb = function(err, methodName) {}) {
    while (true) {
      let bufferSnapshot = this._buffer.slice()
      try {
        let responseCode = this.readAndShiftInt()
        let responseFunctionName = this._responseCodeToString(responseCode)
        cb(null, responseFunctionName)
      } catch (e) {
        if (!(e instanceof UnderrunError)) cb(e, null)
        this._restoreLastChunk(bufferSnapshot)
        return
      }
    }
  }

  _responseCodeToString(responseCode) {
    for (let key in INCOMING) {
      if (INCOMING[key] === responseCode) {
        return key
      }
    }
    return TICK_TYPE.UNKNOWN
  }
}
export default BufferParser
