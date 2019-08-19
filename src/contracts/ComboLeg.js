import assert from 'assert'
import { DEFAULT_EXCHANGE, ACTION } from '../constants'

export default class {
  constructor({ conId, ratio, action, exchange }) {
    assert(typeof conId === 'number', 'Contract Id must be a number.')
    assert(!ratio || typeof ratio === 'number', 'Ratio must be a number.')
    assert([ACTION.BUY, ACTION.SELL].includes(action), 'Action must either be BUY or SELL.')

    this._contract = { conId, ratio, action, exchange }
  }
  get() {
    return {
      conId: this._contract.conId,
      ratio: this._contract.ratio || 1,
      action: this._contract.action || ACTION.BUY,
      exchange: this._contract.exchange || DEFAULT_EXCHANGE
    }
  }
}
