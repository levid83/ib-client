import http from 'http'

import Socket from './src/Socket'
import IBClient from './src'
import ContractBuilder from './src/ContractBuilder'
import OrderBuilder from './src/OrderBuilder'

const port = 3000
const server = http.createServer()

const socket = new Socket({ host: '127.0.0.1', port: 5030 })
const brokerClient = new IBClient({ socket: socket, clientId: 0 })
brokerClient.on('error', err =>
  console.log('error id: ', err.id, ' code: ', err.code, ' message: ', err.message)
)
brokerClient.connect()

const contract = new ContractBuilder()
  .setSymbol('AAPL')
  .setSecType('STK')
  .setExchange('NYSE')
  .build()

const order = new OrderBuilder()
  .setAccount('DU535418')
  .setAction('BUY')
  .setQuantity(1)
  .setOrderType('LMT')
  .setLimitPrice(200)
  .build()

brokerClient.on('nextValidId', id => brokerClient.placeOrder(id, contract, order))

server.on('error', onError)
server.listen(port, () => console.log(`server is listening on port ${port}`))

function onError(error) {
  if (error.syscall !== 'listen') throw error
  switch (error.code) {
    case 'EACCES':
      console.error('Port ' + port + ' requires elevated privileges')
      process.exit(1)
    case 'EADDRINUSE':
      console.error('Port ' + port + ' is already in use')
      process.exit(1)
    default:
      throw error
  }
}
