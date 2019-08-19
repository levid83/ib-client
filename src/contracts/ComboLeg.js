import { DEFAULT_EXCHANGE, ACTION } from '../constants'

export default class {
  constructor(settings = { conId, ratio, action, exchange }) {
    assert(typeof conId === 'number', 'Contract Id must be a number.')
    assert(!ratio || typeof ratio === 'number', 'Ratio must be a number.')
    assert([ACTION.BUY, ACTION.SELL].includes(action), 'Action must either be BUY or SELL.')
    assert(typeof exchange === 'string' && exchange.length > 0, 'Exchange must be a string.')

    this.contract = settings
  }
  get() {
    return {
      conId: this.contract.conId,
      ratio: this.contract.ratio || 1,
      action: this.contract.action || ACTION.BUY,
      exchange: this.contract.exchange || DEFAULT_EXCHANGE
    }
  }
}
