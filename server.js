import http from 'http'

const port = process.env.PORT || 3001

const server = http.createServer()

server.on('error', onError)

server.listen(port, () => {
  console.log(`server is listening on port ${port}`)
})

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
