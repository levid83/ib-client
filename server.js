import http from 'http'

import Socket from './src/Socket'
import IBClient from './src'
import ContractBuilder from './src/ContractBuilder'
import Stock from './src/contracts/Stock'

const port = 3000
const server = http.createServer()

const socket = new Socket({ host: '127.0.0.1', port: 5030 })
const brokerClient = new IBClient({ socket: socket, clientId: 0 })

brokerClient.on('nextValidId', id => console.log('nextValidId ', id))

brokerClient.connect()
brokerClient.reqIds(1)

const contract = new ContractBuilder()
  .setSymbol('AAPL')
  .setSecType('STK')
  .build()

const contract2 = new ContractBuilder()
  .setSymbol('CL')
  .setSecType('FUT')
  .setExpiry('2019-10')
  .setStrike(60.5)
  .setRight('PUT')
  .setMultiplier('1000')
  .build()

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
