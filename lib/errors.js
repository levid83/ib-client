class UnderrunError extends Error {
  constructor(message) {
    super()
    this.name = 'UnderrunError'
    this.message = message || 'An underrun error has occurred'
    this.stack = new Error().stack
  }
}
export default UnderrunError
