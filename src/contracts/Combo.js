import { SEC_TYPE, DEFAULT_CURRENCY, DEFAULT_EXCHANGE } from '../constants'

export default class {
  constructor(settings = { symbol, comboLegs, currency, exchange }) {
    assert(typeof symbol === 'string' && symbol.length > 0, 'Symbol must be a string.')
    assert(Array.isArray(comboLegs) && comboLegs.length > 0, 'Combo Legs must be an array.')
    assert(typeof currency === 'string' && currency.length > 0, 'Currency must be a string.')
    assert(typeof exchange === 'string' && exchange.length > 0, 'Exchange must be a string.')

    this.contract = settings
  }
  get() {
    return {
      symbol: this.contract.symbol,
      secType: SEC_TYPE.BAG,
      comboLegs: null,
      currency: this.contract.currency || DEFAULT_CURRENCY,
      exchange: this.contract.exchange || DEFAULT_EXCHANGE
    }
  }
}
