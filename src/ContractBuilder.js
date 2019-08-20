import assert from 'assert'
import Combo from './contracts/Combo'
import ComboLeg from './contracts/ComboLeg'
import { SEC_TYPE } from './constants'
import Stock from './contracts/Stock'
import StockOption from './contracts/StockOption'
import Future from './contracts/Future'
import FutureOption from './contracts/FutureOption'

export default class ContractBuilder {
  constructor(contract = {}) {
    this.conId = contract.conId || undefined
    this.symbol = contract.symbol || undefined
    this.secType = contract.secType || undefined
    this.expiry = contract.expiry || undefined
    this.strike = contract.strike || undefined
    this.right = contract.right || undefined
    this.multiplier = contract.multiplier || undefined
    this.comboLegs = contract.comboLegs || []
    this.exchange = contract.exchange || undefined
    this.currency = contract.currency || undefined
  }

  setConId(conId) {
    this.conId = conId
  }
  setSymbol(symbol) {
    this.symbol = symbol
    return this
  }
  setSecType(secType) {
    this.secType = secType
    return this
  }
  setExpiry(expiry) {
    this.expiry = expiry
    return this
  }
  setStrike(strike) {
    this.strike = strike
    return this
  }
  setRight(right) {
    this.right = right
    return this
  }
  setMultiplier(multiplier) {
    this.multiplier = multiplier
    return this
  }
  addComboLeg(comboLeg) {
    assert(!comboLeg instanceof ComboLeg, 'comboLeg must be a ComboLeg instance.')
    this.comboLegs = comboLeg
    return this
  }
  setExchange(exchange) {
    this.exchange = exchange
    return this
  }
  setCurrency(currency) {
    this.currency = currency
    return this
  }

  build() {
    switch (this.secType) {
      case SEC_TYPE.STOCK:
        return new Stock(this)
      case SEC_TYPE.STOCK_OPTION:
        return new StockOption(this)
      case SEC_TYPE.FUTURE:
        return new Future(this)
      case SEC_TYPE.FUTURE_OPTION:
        return new FutureOption(this)
      case SEC_TYPE.BAG:
        if (!Array.isArray(this.comboLegs) || this.comboLegs.length < 2)
          throw Error('Combo has no or just one leg.')
        return new Combo(this)
      default:
        throw Error('Unknown security type.')
    }
  }
}
