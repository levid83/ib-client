import { validateInput } from '../validators'
import { ORDER_TYPE, ACTION, TIME_IN_FORCE } from '../constants'

export default class {
  constructor({ account, action, quantity, limitPrice, parentId, transmitOrder, tif, outsideRth }) {
    validateInput(typeof account === 'string' && account.length > 0, 'Account must be a string.')
    validateInput([ACTION.BUY, ACTION.SELL].includes(action), 'Action must either be BUY or SELL.')
    validateInput(typeof quantity === 'number', 'Quantity must be a number.')
    validateInput(typeof limitPrice === 'number', 'Limit Price must be a number.')
    if (parentId)
      validateInput(
        Number.isInteger(parentId) && parentId >= 0,
        'ParentId must be a positive integer.'
      )
    if (transmitOrder)
      validateInput(typeof transmitOrder === 'boolean', 'TransmitOrder must be a string.')
    if (tif)
      validateInput(
        [TIME_IN_FORCE.DAY, TIME_IN_FORCE.GTC].includes(tif),
        'Time in force must either be GTC or DAY.'
      )
    if (outsideRth)
      validateInput(
        typeof outsideRth === 'boolean',
        'Outside Regular Trading Hours must be a string.'
      )

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
