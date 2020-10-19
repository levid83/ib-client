import { validateInput } from '../validators'
import { SEC_TYPE, DEFAULT_CURRENCY, DEFAULT_EXCHANGE } from '../constants'

export default class {
  constructor({ conId, symbol, currency, exchange }) {
    if (!conId) {
      validateInput(typeof symbol === 'string' && symbol.length > 0, 'Symbol must be a string.')
    } else {
      validateInput(typeof conId === 'number', 'Contract Id must be a number.')
    }

    this.conId = conId || undefined
    this.symbol = symbol || undefined
    this.secType = SEC_TYPE.STOCK
    this.currency = currency || DEFAULT_CURRENCY
    this.exchange = exchange || DEFAULT_EXCHANGE
  }
}
