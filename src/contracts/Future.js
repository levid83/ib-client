import assert from 'assert'
import { SEC_TYPE, DEFAULT_CURRENCY, DEFAULT_EXCHANGE } from '../constants'

export default class {
  constructor({ conId, symbol, expiry, multiplier, currency, exchange }) {
    if (!conId) {
      assert(typeof symbol === 'string' && symbol.length > 0, 'Symbol must be a string.')
      assert(typeof expiry === 'string' && expiry.length > 0, 'Expiry must be a string.')
      assert(
        typeof multiplier === 'string' && multiplier.length > 0,
        'Multiplier must be a string.'
      )
    } else {
      assert(typeof conId === 'number', 'Contract Id must be a number.')
    }

    this._contract = { conId, symbol, expiry, currency, exchange }
  }
  get() {
    return {
      conId: this._contract.conId || undefined,
      symbol: this._contract.symbol || undefined,
      secType: SEC_TYPE.FUTURE,
      expiry: this._contract.expiry || undefined,
      multiplier: this._contract.multiplier || undefined,
      currency: this._contract.currency || DEFAULT_CURRENCY,
      exchange: this._contract.exchange || DEFAULT_EXCHANGE
    }
  }
}
