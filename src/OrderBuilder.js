import { ORDER_TYPE } from './constants'
import Market from './orders/Market'
import Limit from './orders/Limit'
import Stop from './orders/Stop'

export default class OrderBuilder {
  constructor(order = {}) {
    this.account = order.account || undefined
    this.action = order.action || undefined
    this.quantity = order.quantity || undefined
    this.orderType = order.orderType || undefined
    this.limitPrice = order.limitPrice || undefined
    this.stopPrice = order.stopPrice || undefined
    this.parentId = order.parentId || undefined
    this.transmitOrder = order.transmitOrder || undefined
    this.tif = order.tif || undefined
    this.outsideRth = order.outsideRth || undefined
  }
  setAccount(account) {
    this.account = account
    return this
  }

  setAction(action) {
    this.action = action
    return this
  }
  setQuantity(quantity) {
    this.quantity = quantity
    return this
  }
  setOrderType(orderType) {
    this.orderType = orderType
    return this
  }
  setLimitPrice(limitPrice) {
    this.limitPrice = limitPrice
    return this
  }

  setStopPrice(stopPrice) {
    this.stopPrice = stopPrice
    return this
  }

  setParentId(parentId) {
    this.parentId = parentId
    return this
  }
  setTransmitOrder(transmitOrder) {
    this.transmitOrder = transmitOrder
    return this
  }
  setTimeInForce(tif) {
    this.tif = tif
    return this
  }
  setOutsideRth(outsideRth) {
    this.outsideRth = outsideRth
    return this
  }

  build() {
    switch (this.orderType) {
      case ORDER_TYPE.MARKET:
        return new Market(this)
      case ORDER_TYPE.LIMIT:
        return new Limit(this)
      case ORDER_TYPE.STOP:
        return new Stop(this)
      default:
        throw Error('Unknown order type.')
    }
  }
}
