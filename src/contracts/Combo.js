import assert from 'assert'
import { SEC_TYPE, DEFAULT_CURRENCY, DEFAULT_EXCHANGE } from '../constants'

export default class {
  constructor({ symbol, comboLegs, currency, exchange }) {
    assert(typeof symbol === 'string' && symbol.length > 0, 'Symbol must be a string.')
    assert(Array.isArray(comboLegs) && comboLegs.length > 0, 'Combo Legs must be an array.')

    this.symbol = symbol || undefined
    this.secType = SEC_TYPE.BAG
    this.comboLegs = comboLegs || null
    this.currency = currency || DEFAULT_CURRENCY
    this.exchange = exchange || DEFAULT_EXCHANGE
  }
}
