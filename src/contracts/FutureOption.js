import assert from 'assert'
import { SEC_TYPE, RIGHT, DEFAULT_CURRENCY, DEFAULT_EXCHANGE } from '../constants'

export default class {
  constructor({ conId, symbol, strike, expiry, right, multiplier, currency, exchange }) {
    if (!conId) {
      assert(typeof symbol === 'string' && symbol.length > 0, 'Symbol must be a string.')
      assert(typeof strike === 'number', 'Strike must be a number.')
      assert(typeof expiry === 'string' && expiry.length > 0, 'Expiry must be a string.')
      assert([RIGHT.CALL, RIGHT.PUT].includes(right), 'Right must either be CALL or PUT.')
      assert(
        typeof multiplier === 'string' && multiplier.length > 0,
        'Multiplier must be a string.'
      )
    } else {
      assert(typeof conId === 'number', 'Contract Id must be a number.')
    }

    this._contract = { conId, symbol, strike, expiry, right, multiplier, currency, exchange }
  }
  get() {
    return {
      conId: this._contract.conId || undefined,
      symbol: this._contract.symbol || undefined,
      secType: SEC_TYPE.FUTURE_OPTION || undefined,
      strike: this._contract.strike || undefined,
      expiry: this._contract.expiry || undefined,
      right: this._contract.right || undefined,
      multiplier: this._contract.multiplier || undefined,
      currency: this._contract.currency || DEFAULT_CURRENCY,
      exchange: this._contract.exchange || DEFAULT_EXCHANGE
    }
  }
}
