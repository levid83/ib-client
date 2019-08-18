import Queue from 'better-queue'
import rateLimit from 'function-rate-limit'
import { MAX_REQ_PER_SECOND, QUEUE_RETRY_TIMEOUT_MS } from './constants'

export default class extends Queue {
  constructor(
    options = {
      eventHandler: null,
      socket: null
    }
  ) {
    super(
      rateLimit(MAX_REQ_PER_SECOND, 1000, function({ message }, cb) {
        options.socket.write(message, result => options.eventHandler.emit('sent', message, result))
        cb(null, true)
      }),
      {
        precondition: cb => cb(null, options.socket.isConnected()),
        preconditionRetryTimeout: QUEUE_RETRY_TIMEOUT_MS,
        priority: ({ func }, cb) =>
          ['sendClientVersion', 'sendClientId'].includes(func) ? cb(null, 10) : cb(null, 5)
      }
    )
    this._socket = options.socket
    this._eventHandler = options.eventHandler
  }
}
