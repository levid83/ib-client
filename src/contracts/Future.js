import { SEC_TYPE, DEFAULT_CURRENCY, DEFAULT_EXCHANGE } from '../constants'

export default class {
  constructor(settings = { conId, symbol, expiry, currency, exchange }) {
    if (!conId) {
      assert(typeof symbol === 'string' && symbol.length > 0, 'Symbol must be a string.')
      assert(typeof expiry === 'string' && expiry.length > 0, 'Expiry must be a string.')
      assert(
        typeof multiplier === 'string' && multiplier.length > 0,
        'Multiplier must be a string.'
      )
      assert(typeof currency === 'string' && currency.length > 0, 'Currency must be a string.')
      assert(typeof exchange === 'string' && exchange.length > 0, 'Exchange must be a string.')
    } else {
      assert(typeof conId === 'number', 'Contract Id must be a number.')
    }

    this.contract = settings
  }
  get() {
    return {
      conId: this.contract.conId || undefined,
      symbol: this.contract.symbol || undefined,
      secType: SEC_TYPE.FUTURE,
      expiry: this.contract.expiry || undefined,
      multiplier: this.contract.multiplier || undefined,
      currency: this.contract.currency || DEFAULT_CURRENCY,
      exchange: this.contract.exchange || DEFAULT_EXCHANGE
    }
  }
}
