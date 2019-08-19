import assert from 'assert'
import { SEC_TYPE, DEFAULT_CURRENCY, DEFAULT_EXCHANGE } from '../constants'

export default class {
  constructor({ symbol, comboLegs, currency, exchange }) {
    assert(typeof symbol === 'string' && symbol.length > 0, 'Symbol must be a string.')
    assert(Array.isArray(comboLegs) && comboLegs.length > 0, 'Combo Legs must be an array.')

    this._contract = { symbol, comboLegs, currency, exchange }
  }

  get() {
    return {
      symbol: this._contract.symbol,
      secType: SEC_TYPE.BAG,
      comboLegs: null,
      currency: this._contract.currency || DEFAULT_CURRENCY,
      exchange: this._contract.exchange || DEFAULT_EXCHANGE
    }
  }
}
