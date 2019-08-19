import { SEC_TYPE, DEFAULT_CURRENCY, DEFAULT_EXCHANGE } from '../constants'

export default class {
  constructor(settings = { conId, symbol, currency, exchange }) {
    if (!conId) {
      assert(typeof symbol === 'string' && symbol.length > 0, 'Symbol must be a string.')
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
      secType: SEC_TYPE.STOCK,
      currency: this.contract.currency || DEFAULT_CURRENCY,
      exchange: this.contract.exchange || DEFAULT_EXCHANGE
    }
  }
}
