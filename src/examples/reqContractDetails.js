import { InputTypeError } from '../errors'
import brokerClient from './brokerClient'
import { ContractBuilder, SEC_TYPE } from '..'

// create futures contract object
const futuresContract = new ContractBuilder()
  .setSymbol('CL')
  .setSecType(SEC_TYPE.FUTURES)
  .setExchange('NYMEX')
  .setExpiry('202208')
  .setMultiplier(1000)
  .build()

let requestId = 1
brokerClient.connect()

//listen to connect event
brokerClient.on('nextValidId', nextOrderId => {
  try {
    brokerClient.reqContractDetails(requestId++, futuresContract)
  } catch (err) {
    if (err instanceof InputTypeError) console.log(err)
    else throw err
  }
})

// listen to contract details event
brokerClient.on('contractDetails', (reqId, details) => {
  console.log(reqId, details)
  brokerClient.disconnect()
})

brokerClient.on('error', (id, code, message) =>
  console.log('Error id: ', id, ' code: ', code, ' message: ', message)
)
