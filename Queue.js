import Queue from 'better-queue'
import rateLimit from 'function-rate-limit'
import { MAX_REQ_PER_SECOND } from './constants'

const RETRY_TIMEOUT = 100

export default class extends Queue {
  constructor(
    options = {
      eventEmitter: null,
      socket: null
    }
  ) {
    super(
      rateLimit(MAX_REQ_PER_SECOND, 1000, function({ message }, cb) {
        options.socket.write(message, result => options.eventEmitter.emit('sent', message, result))
        cb(null, true)
      }),
      {
        precondition: cb => cb(null, options.socket.isConnected()),
        preconditionRetryTimeout: RETRY_TIMEOUT,
        priority: ({ func }, cb) =>
          ['sendClientVersion', 'sendClientId'].includes(func) ? cb(null, 10) : cb(null, 5)
      }
    )
    this._socket = options.socket
    this._eventEmitter = options.eventEmitter
  }
}
