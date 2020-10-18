import Queue from 'better-queue'

export default class extends Queue {
  constructor(onMessage = null) {
    super(onMessage)
  }
}
