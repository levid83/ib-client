import Queue from 'better-queue'
import rateLimit from 'function-rate-limit'
import { MAX_REQ_PER_SECOND, QUEUE_RETRY_TIMEOUT_MS } from './constants'

export default class extends Queue {
  constructor(onMessage, { preCondition, priority }) {
    super(rateLimit(MAX_REQ_PER_SECOND, 1000, onMessage), {
      precondition: preCondition,
      preconditionRetryTimeout: QUEUE_RETRY_TIMEOUT_MS,
      priority: priority
    })
  }
}
