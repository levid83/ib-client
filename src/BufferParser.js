import { UnderrunError } from './errors'
import { INCOMING, EOL } from './constants'

class BufferParser {
  constructor(buffer = []) {
    this._buffer = buffer
  }

  isEmpty() {
    return this._buffer.length === 0
  }
  read() {
    if (this.isEmpty()) throw new UnderrunError()
    return this._buffer.shift()
  }

  readBool() {
    return !!parseInt(this.readString(), 10)
  }

  readFloat() {
    return parseFloat(this.readString())
  }

  readInt() {
    return parseInt(this.readString(), 10)
  }

  readFloatMax() {
    let str = this.readString()
    if (!str) return Number.MAX_VALUE
    else parseInt(str, 10)
  }

  readIntMax() {
    let str = this.readString()
    if (!str) return 0x7fffffff
    else parseInt(str, 10)
  }

  readString() {
    let str = ''
    while (!this.isEmpty()) {
      let element = String.fromCharCode(this.read().toString())
      if (element === EOL) break
      str = str.concat(element)
    }
    return str
  }

  readLengthHeader() {
    let mask = 0xffffffff
    return (
      ((mask & this.read()) << 24) |
      ((mask & this.read()) << 16) |
      ((mask & this.read()) << 8) |
      (mask & this.read())
    )
  }

  process(cb = function(err, methodName) {}) {
    try {
      let responseCode = this.readInt()
      let responseFunctionName = this._responseCodeToString(responseCode)
      if (!responseFunctionName) {
        cb(new Error('Unknown response code ', responseCode), null)
      } else {
        return cb(null, responseFunctionName)
      }
    } catch (e) {
      throw e
    }
  }

  _responseCodeToString(responseCode) {
    for (let key in INCOMING) {
      if (INCOMING[key] === responseCode) {
        return key
      }
    }
    return false
  }

  _restoreLastChunk(chunk) {
    this._buffer = this._buffer.concat(chunk)
  }
}
export default BufferParser
