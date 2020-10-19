This is a Node.js version of Interactive Brokers' TWS/IBGW API official client library.
It's compatible with TWS API 974 and earlier versions too.

### Extra features:

- built in retries on lost TWS API connection
- high priority `connect` commands when trying to reconnect to TWS/Gateway
- commands held in a queue until processed
- V100+ connection mechanism allowed
- builder classes for contracts and orders

### Library structure:

The library consists of 4 modules:

1. Inner Socket module makes connection to TWS/IBGW API using net and events modules
2. Message transformation module:

   - Message Encoder: converts client requests to binary sequences using messaging protocols of TWS API
   - Message Decoder: converts the incoming TWS API's binary sequences to javascript objects

3. Queue module:

   - Outbound Queue: enques the commands comming from the Client module. When processing, it calls the Encoder with the commands, then it sends the encoded results to the Socket. In addition, it applies rate limiting, retries and message prioritization techniques
   - Inbound Queue: receives messages from the Socket. When processing, it calls the Decoder with the messages, then sends the decoded results back to the Client module.

4. Client module:
   - implements the IB Client interface
   - validates the commands and pushes them into Qutbound Queue
   - receives responses from Inbound Queue and emits events to pass the results back to user
   - manages the other modules

The API Client uses the same API command method- and parameter names as the Java version ([see the TWS/IBGW API documentation](https://interactivebrokers.github.io/tws-api/index.html))

It uses EventEmmitter to pass back the responses from TWS/IBGW API. For better usage the response events are named after the event listener names used in the Java version.

### Usage:

See the examples [here](https://github.com/levid83/ib-client/tree/master/src/examples)
