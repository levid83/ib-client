import assert from 'assert'
import { ORDER_TYPE, ACTION, TIME_IN_FORCE } from '../constants'

export default class {
  constructor({ account, action, quantity, limitPrice, parentId, transmitOrder, tif, outsideRth }) {
    assert(typeof account === 'string' && account.length > 0, 'Account must be a string.')
    assert([ACTION.BUY, ACTION.SELL].includes(action), 'Action must either be BUY or SELL.')
    assert(typeof quantity === 'number', 'Quantity must be a number.')
    assert(typeof limitPrice === 'number', 'Limit Price must be a number.')
    if (parentId)
      assert(Number.isInteger(parentId) && parentId >= 0, 'ParentId must be a positive integer.')
    if (transmitOrder) assert(typeof transmitOrder === 'boolean', 'TransmitOrder must be a string.')
    if (tif)
      assert(
        [TIME_IN_FORCE.DAY, TIME_IN_FORCE.GTC].includes(tif),
        'Time in force must either be GTC or DAY.'
      )
    if (outsideRth)
      assert(typeof outsideRth === 'boolean', 'Outside Regular Trading Hours must be a string.')

    this.account = account || undefined
    this.action = action || undefined
    this.totalQuantity = quantity || undefined
    this.orderType = ORDER_TYPE.LIMIT
    this.lmtPrice = limitPrice || undefined
    this.parentId = parentId || 0
    this.transmit = transmitOrder || true
    this.tif = tif || TIME_IN_FORCE.GTC
    this.outsideRth = outsideRth || undefined
  }
}
