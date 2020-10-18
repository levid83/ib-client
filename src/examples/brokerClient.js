import IBClient from '..'

//replace this with your IB account id
const BROKER_ACCOUNT = 'DU123456'
const API_CLIENT_ID = 0
const HOST = '127.0.0.1'
//default port
const PORT = 7497

const brokerClient = new IBClient({
  socket: { host: HOST, port: PORT },
  clientId: API_CLIENT_ID
})

export default brokerClient
