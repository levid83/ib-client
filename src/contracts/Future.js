import assert from 'assert'
import { SEC_TYPE, DEFAULT_CURRENCY, DEFAULT_EXCHANGE } from '../constants'

export default class {
  constructor({ conId, symbol, expiry, multiplier, currency, exchange }) {
    if (!conId) {
      assert(typeof symbol === 'string' && symbol.length > 0, 'Symbol must be a string.')
      assert(typeof expiry === 'string' && expiry.length > 0, 'Expiry must be a string.')
    } else {
      assert(typeof conId === 'number', 'Contract Id must be a number.')
    }

    this.conId = conId || undefined
    this.symbol = symbol || undefined
    this.secType = SEC_TYPE.FUTURE
    this.expiry = expiry || undefined
    this.multiplier = multiplier || undefined
    this.currency = currency || DEFAULT_CURRENCY
    this.exchange = exchange || DEFAULT_EXCHANGE
  }
}
