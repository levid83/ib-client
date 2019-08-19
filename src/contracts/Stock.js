import assert from 'assert'
import { SEC_TYPE, DEFAULT_CURRENCY, DEFAULT_EXCHANGE } from '../constants'

export default class {
  constructor({ conId, symbol, currency, exchange }) {
    if (!conId) {
      assert(typeof symbol === 'string' && symbol.length > 0, 'Symbol must be a string.')
    } else {
      assert(typeof conId === 'number', 'Contract Id must be a number.')
    }

    this._contract = { conId, symbol, currency, exchange }
  }
  get() {
    return {
      conId: this._contract.conId || undefined,
      symbol: this._contract.symbol || undefined,
      secType: SEC_TYPE.STOCK,
      currency: this._contract.currency || DEFAULT_CURRENCY,
      exchange: this._contract.exchange || DEFAULT_EXCHANGE
    }
  }
}
