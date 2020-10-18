import brokerClient from './brokerClient'
import {
  ContractBuilder,
  OrderBuilder,
  SEC_TYPE,
  ORDER_TYPE,
  ACTION,
  TIME_IN_FORCE,
  RIGHT
} from '..'

// create contract object
const stockContract = new ContractBuilder()
  .setSymbol('MSFT')
  .setSecType(SEC_TYPE.STOCK)
  .build()

// create order object
const stockOrder = new OrderBuilder()
  .setAccount(BROKER_ACCOUNT)
  .setAction(ACTION.BUY)
  .setQuantity(100)
  .setOrderType(ORDER_TYPE.LIMIT)
  .setLimitPrice(0.01)
  .setTimeInForce(TIME_IN_FORCE.GTC)
  .build()

const optionContract = new ContractBuilder()
  .setSymbol('MSFT')
  .setSecType(SEC_TYPE.STOCK_OPTION)
  .setRight(RIGHT.PUT)
  .setStrike(30)
  .build()

const optionOrder = new OrderBuilder()
  .setAccount(BROKER_ACCOUNT)
  .setAction(ACTION.SELL)
  .setQuantity(10)
  .setOrderType(ORDER_TYPE.LIMIT)
  .setLimitPrice(20.0)
  .setTimeInForce(TIME_IN_FORCE.GTC)
  .build()

brokerClient.connect()

//listen to connect event
brokerClient.on('nextValidId', nextOrderId => {
  // Place buy stock order
  brokerClient.placeOrder(nextOrderId, stockContract, stockOrder)
  //increment nextOrderId
  nextOrderId++

  // Place sell put option order
  brokerClient.placeOrder(nextOrderId, optionContract, optionOrder)
})

//listen to order opened event
brokerClient.on('openOrder', (id, contract, order, orderState) => {
  console.log('open order', { id, contract, order, orderState })
  brokerClient.disconnect()
})

brokerClient.on('error', (id, code, message) =>
  console.log('Error id: ', id, ' code: ', code, ' message: ', message)
)
