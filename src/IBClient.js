import assert, { fail } from 'assert'
import { EventEmitter } from 'events'

import { CLIENT_VERSION } from './constants'
import Socket from './Socket'
import Queue from './Queue'
import MessageEncoder from './MessageEncoder'
import MessageDecoder from './MessageDecoder'

// Client version history
//
// 	6 = Added parentId to orderStatus
// 	7 = The new execDetails event returned for an order filled status and reqExecDetails
//     Also market depth is available.
// 	8 = Added lastFillPrice to orderStatus() event and permId to execution details
//  9 = Added 'averageCost', 'unrealizedPNL', and 'unrealizedPNL' to updatePortfolio event
// 10 = Added 'serverId' to the 'open order' & 'order status' events.
//      We send back all the API open orders upon connection.
//      Added new methods reqAllOpenOrders, reqAutoOpenOrders()
//      Added FA support - reqExecution has filter.
//                       - reqAccountUpdates takes acct code.
// 11 = Added permId to openOrder event.
// 12 = requesting open order attributes ignoreRth, hidden, and discretionary
// 13 = added goodAfterTime
// 14 = always send size on bid/ask/last tick
// 15 = send allocation description string on openOrder
// 16 = can receive account name in account and portfolio updates, and fa params in openOrder
// 17 = can receive liquidation field in exec reports, and notAutoAvailable field in mkt data
// 18 = can receive good till date field in open order messages, and request intraday backfill
// 19 = can receive rthOnly flag in ORDER_STATUS
// 20 = expects TWS time string on connection after server version >= 20.
// 21 = can receive bond contract details.
// 22 = can receive price magnifier in version 2 contract details message
// 23 = support for scanner
// 24 = can receive volatility order parameters in open order messages
// 25 = can receive HMDS query start and end times
// 26 = can receive option vols in option market data messages
// 27 = can receive delta neutral order type and delta neutral aux price in place order version 20: API 8.85
// 28 = can receive option model computation ticks: API 8.9
// 29 = can receive trail stop limit price in open order and can place them: API 8.91
// 30 = can receive extended bond contract def, new ticks, and trade count in bars
// 31 = can receive EFP extensions to scanner and market data, and combo legs on open orders
//    ; can receive RT bars
// 32 = can receive TickType.LAST_TIMESTAMP
//    ; can receive "whyHeld" in order status messages
// 33 = can receive ScaleNumComponents and ScaleComponentSize is open order messages
// 34 = can receive whatIf orders / order state
// 35 = can receive contId field for Contract objects
// 36 = can receive outsideRth field for Order objects
// 37 = can receive clearingAccount and clearingIntent for Order objects
// 38 = can receive multiplier and primaryExchange in portfolio updates
//    ; can receive cumQty and avgPrice in execution
//    ; can receive fundamental data
//    ; can receive deltaNeutralContract for Contract objects
//    ; can receive reqId and end marker in contractDetails/bondContractDetails
//    ; can receive ScaleInitComponentSize and ScaleSubsComponentSize for Order objects
// 39 = can receive underConId in contractDetails
// 40 = can receive algoStrategy/algoParams in openOrder
// 41 = can receive end marker for openOrder
//    ; can receive end marker for account download
//    ; can receive end marker for executions download
// 42 = can receive deltaNeutralValidation
// 43 = can receive longName(companyName)
//    ; can receive listingExchange
//    ; can receive RTVolume tick
// 44 = can receive end market for ticker snapshot
// 45 = can receive notHeld field in openOrder
// 46 = can receive contractMonth, industry, category, subcategory fields in contractDetails
//    ; can receive timeZoneId, tradingHours, liquidHours fields in contractDetails
// 47 = can receive gamma, vega, theta, undPrice fields in TICK_OPTION_COMPUTATION
// 48 = can receive exemptCode in openOrder
// 49 = can receive hedgeType and hedgeParam in openOrder
// 50 = can receive optOutSmartRouting field in openOrder
// 51 = can receive smartComboRoutingParams in openOrder
// 52 = can receive deltaNeutralConId, deltaNeutralSettlingFirm, deltaNeutralClearingAccount and deltaNeutralClearingIntent in openOrder
// 53 = can receive orderRef in execution
// 54 = can receive scale order fields (PriceAdjustValue, PriceAdjustInterval, ProfitOffset, AutoReset,
//      InitPosition, InitFillQty and RandomPercent) in openOrder
// 55 = can receive orderComboLegs (price) in openOrder
// 56 = can receive trailingPercent in openOrder
// 57 = can receive commissionReport message
// 58 = can receive CUSIP/ISIN/etc. in contractDescription/bondContractDescription
// 59 = can receive evRule, evMultiplier in contractDescription/bondContractDescription/executionDetails
//      can receive multiplier in executionDetails
// 60 = can receive deltaNeutralOpenClose, deltaNeutralShortSale, deltaNeutralShortSaleSlot and deltaNeutralDesignatedLocation in openOrder
// 61 = can receive multiplier in openOrder
//      can receive tradingClass in openOrder, updatePortfolio, execDetails and position
// 62 = can receive avgCost in position message
// 63 = can receive verifyMessageAPI, verifyCompleted, displayGroupList and displayGroupUpdated messages
// 64 = can receive solicited attrib in openOrder message
// 65 = can receive verifyAndAuthMessageAPI and verifyAndAuthCompleted messages
// 66 = can receive randomize size and randomize price order fields

class IBClient extends EventEmitter {
  constructor(options = { socket: null, clientId: null }) {
    super()
    this._clientId = options.clientId
    this._socket = this._initSocket(new Socket(options.socket))
    this._messageEncoder = new MessageEncoder({
      eventHandler: this,
      queue: new Queue({ eventHandler: this, socket: this._socket })
    })
    this._messageDecoder = new MessageDecoder({
      eventHandler: this
    })
  }

  connect() {
    this._socket.connect(() => this.sendClientVersion().sendClientId())
    return this
  }
  disconnect() {
    this.schedule('disconnect')
    return this
  }

  sendClientVersion() {
    this._sendRequest('sendClientVersion', CLIENT_VERSION)
    return this
  }

  sendClientId() {
    assert(Number.isInteger(this._clientId), '"clientId" must be an integer - ' + this._clientId)
    this._sendRequest('sendClientId', this._clientId)
    return this
  }

  calculateImpliedVolatility(reqId, contract, optionPrice, underPrice) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendRequest('calculateImpliedVolatility', reqId, contract, optionPrice, underPrice)
    return this
  }
  calculateOptionPrice(reqId, contract, volatility, underPrice) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendRequest('calculateOptionPrice', reqId, contract, volatility, underPrice)
    return this
  }
  cancelAccountSummary(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendRequest('cancelAccountSummary', reqId)
    return this
  }
  cancelPositionsMulti(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendRequest('cancelPositionsMulti', reqId)
    return this
  }
  cancelAccountUpdatesMulti(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendRequest('cancelAccountUpdatesMulti', reqId)
    return this
  }
  cancelCalculateImpliedVolatility(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendRequest('cancelCalculateImpliedVolatility', reqId)
    return this
  }
  cancelCalculateOptionPrice(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendRequest('cancelCalculateOptionPrice', reqId)
    return this
  }
  cancelFundamentalData(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendRequest('cancelFundamentalData', reqId)
    return this
  }
  cancelHistoricalData(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    this._sendRequest('cancelHistoricalData', tickerId)
    return this
  }
  cancelMktData(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    this._sendRequest('cancelMktData', tickerId)
    return this
  }
  cancelMktDepth(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    this._sendRequest('cancelMktDepth', tickerId)
    return this
  }
  cancelNewsBulletins() {
    this._sendRequest('cancelNewsBulletins')
    return this
  }
  cancelOrder(id) {
    assert(Number.isInteger(id), '"id" must be an integer - ' + id)
    this._sendRequest('cancelOrder', id)
    return this
  }
  cancelPositions() {
    this._sendRequest('cancelPositions')
    return this
  }
  cancelRealTimeBars(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    this._sendRequest('cancelRealTimeBars', tickerId)
    return this
  }
  cancelScannerSubscription(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    this._sendRequest('cancelScannerSubscription', tickerId)
    return this
  }
  exerciseOptions(tickerId, contract, exerciseAction, exerciseQuantity, account, override) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    assert(
      Number.isInteger(exerciseAction),
      '"exerciseAction" must be an integer - ' + exerciseAction
    )
    assert(
      Number.isInteger(exerciseQuantity),
      '"exerciseQuantity" must be an integer - ' + exerciseQuantity
    )
    assert(typeof account === 'string', '"account" must be a string - ' + account)
    assert(Number.isInteger(override), '"override" must be an integer - ' + override)
    this._sendRequest(
      'exerciseOptions',
      tickerId,
      contract,
      exerciseAction,
      exerciseQuantity,
      account,
      override
    )
    return this
  }
  placeOrder(id, contract, order) {
    assert(Number.isInteger(id), '"id" must be an integer - ' + id)
    this._sendRequest('placeOrder', id, contract, order)
    return this
  }
  replaceFA(faDataType, xml) {
    assert(Number.isInteger(faDataType), '"faDataType" must be an integer - ' + faDataType)
    assert(typeof xml === 'string', '"xml" must be a string - ' + xml)
    this._sendRequest('replaceFA', faDataType, xml)
    return this
  }
  reqAccountSummary(reqId, group, tags) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof group === 'string', '"group" must be a string - ' + group)
    assert(
      Array.isArray(tags) || typeof tags === 'string',
      '"tags" must be array or string - ' + tags
    )
    if (Array.isArray(tags)) {
      tags = tags.join(',')
    }
    this._sendRequest('reqAccountSummary', reqId, group, tags)
    return this
  }
  reqAccountUpdates(subscribe, acctCode) {
    assert(typeof subscribe === 'boolean', '"subscribe" must be a boolean - ' + subscribe)
    assert(typeof acctCode === 'string', '"acctCode" must be a string - ' + acctCode)
    this._sendRequest('reqAccountUpdates', subscribe, acctCode)
    return this
  }
  reqAccountUpdatesMulti(reqId, acctCode, modelCode, ledgerAndNLV) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof acctCode === 'string', '"acctCode" must be a string - ' + acctCode)
    assert(
      typeof modelCode === 'string' || typeof modelCode === 'object',
      '"modelCode" must be a string or null - ' + modelCode
    )
    assert(typeof ledgerAndNLV === 'boolean', '"ledgerAndNLV" must be a boolean - ' + ledgerAndNLV)
    this._sendRequest('reqAccountUpdatesMulti', reqId, acctCode, modelCode, ledgerAndNLV)
    return this
  }
  reqAllOpenOrders() {
    this._sendRequest('reqAllOpenOrders')
    return this
  }
  reqAutoOpenOrders(bAutoBind) {
    assert(typeof bAutoBind === 'boolean', '"bAutoBind" must be a boolean - ' + bAutoBind)
    this._sendRequest('reqAutoOpenOrders', bAutoBind)
    return this
  }
  reqContractDetails(reqId, contract) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendRequest('reqContractDetails', reqId, contract)
    return this
  }
  reqCurrentTime() {
    this._sendRequest('reqCurrentTime')
    return this
  }
  reqExecutions(reqId, filter) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendRequest('reqExecutions', reqId, filter)
    return this
  }
  reqFundamentalData(reqId, contract, reportType) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof reportType === 'string', '"reportType" must be a string - ' + reportType)
    this._sendRequest('reqFundamentalData', reqId, contract, reportType)
    return this
  }
  reqGlobalCancel() {
    this._sendRequest('reqGlobalCancel')
    return this
  }
  reqHeadTimestamp(reqId, contract, whatToShow, useRTH, formatDate) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof whatToShow === 'string', '"whatToShow" must be a string - ' + whatToShow)
    assert(Number.isInteger(useRTH), '"useRTH" must be an integer - ' + useRTH)
    assert(Number.isInteger(formatDate), '"formatDate" must be an integer - ' + formatDate)
    this._sendRequest('reqHeadTimestamp', reqId, contract, whatToShow, useRTH, formatDate)
  }
  reqSecDefOptParams(reqId, underlyingSymbol, futFopExchange, underlyingSecType, underlyingConId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(
      typeof underlyingSymbol === 'string',
      '"underlyingSymbol" must be a string - ' + underlyingSymbol
    )
    assert(
      typeof futFopExchange === 'string',
      '"futFopExchange" must be a string - ' + futFopExchange
    )
    assert(
      typeof underlyingSecType === 'string',
      '"underlyingSecType" must be a string - ' + underlyingSecType
    )
    assert(
      Number.isInteger(underlyingConId),
      '"underlyingConId" must be an integer - ' + underlyingConId
    )
    this._sendRequest(
      'reqSecDefOptParams',
      reqId,
      underlyingSymbol,
      futFopExchange,
      underlyingSecType,
      underlyingConId
    )
    return this
  }
  reqHistoricalData(
    tickerId,
    contract,
    endDateTime,
    durationStr,
    barSizeSetting,
    whatToShow,
    useRTH,
    formatDate,
    keepUpToDate
  ) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    assert(typeof endDateTime === 'string', '"endDateTime" must be a string - ' + endDateTime)
    assert(typeof durationStr === 'string', '"durationStr" must be a string - ' + durationStr)
    assert(
      typeof barSizeSetting === 'string',
      '"barSizeSetting" must be a string - ' + barSizeSetting
    )
    assert(typeof whatToShow === 'string', '"whatToShow" must be a string - ' + whatToShow)
    assert(Number.isInteger(useRTH), '"useRTH" must be an integer - ' + useRTH)
    assert(Number.isInteger(formatDate), '"formatDate" must be an integer - ' + formatDate)
    assert(typeof keepUpToDate === 'boolean', '"keepUpToDate" must be an boolean - ' + keepUpToDate)
    this._sendRequest(
      'reqHistoricalData',
      tickerId,
      contract,
      endDateTime,
      durationStr,
      barSizeSetting,
      whatToShow,
      useRTH,
      formatDate,
      keepUpToDate
    )
    return this
  }
  reqHistoricalTicks(
    tickerId,
    contract,
    startDateTime,
    endDateTime,
    numberOfTicks,
    whatToShow,
    useRTH,
    ignoreSize
  ) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    if ((startDateTime && endDateTime) || (!startDateTime && !endDateTime)) {
      fail(
        'specify one of "startDateTime" or "endDateTime" (as a string) but not both - ' +
          startDateTime +
          ':' +
          endDateTime
      )
    }
    assert(Number.isInteger(numberOfTicks), '"numberOfTicks" must be a number - ' + numberOfTicks)
    assert(typeof whatToShow === 'string', '"whatToShow" must be a string - ' + whatToShow)
    assert(Number.isInteger(useRTH), '"useRTH" must be an integer - ' + useRTH)
    assert(typeof ignoreSize === 'boolean', '"ignoreSize" must be an boolean - ' + ignoreSize)
    this._sendRequest(
      'reqHistoricalTicks',
      tickerId,
      contract,
      startDateTime,
      endDateTime,
      numberOfTicks,
      whatToShow,
      useRTH,
      ignoreSize
    )
    return this
  }
  reqTickByTickData(tickerId, contract, tickType, numberOfTicks, ignoreSize) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    assert(typeof tickType === 'string', '"tickType" must be a string - ' + tickType)
    assert(Number.isInteger(numberOfTicks), '"numberOfTicks" must be a number - ' + numberOfTicks)
    assert(typeof ignoreSize === 'boolean', '"ignoreSize" must be an boolean - ' + ignoreSize)
    this._sendRequest('reqTickByTickData', tickerId, contract, tickType, numberOfTicks, ignoreSize)
    return this
  }
  cancelTickByTickData(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    this._sendRequest('cancelTickByTickData', tickerId)
    return this
  }
  reqIds(numIds) {
    assert(Number.isInteger(numIds), '"numIds" must be an integer - ' + numIds)
    this._sendRequest('reqIds', numIds)
    return this
  }
  reqManagedAccts() {
    this._sendRequest('reqManagedAccts')
    return this
  }
  reqMarketDataType(marketDataType) {
    assert(
      Number.isInteger(marketDataType),
      '"marketDataType" must be an integer - ' + marketDataType
    )
    this._sendRequest('reqMarketDataType', marketDataType)
    return this
  }
  reqMktData(tickerId, contract, genericTickList, snapshot, regulatorySnapshot) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    assert(
      typeof genericTickList === 'string',
      '"genericTickList" must be a string - ' + genericTickList
    )
    assert(typeof snapshot === 'boolean', '"snapshot" must be a boolean - ' + snapshot)
    assert(
      typeof regulatorySnapshot === 'boolean',
      '"regulatorySnapshot" must be a boolean - ' + regulatorySnapshot
    )
    this._sendRequest(
      'reqMktData',
      tickerId,
      contract,
      genericTickList,
      snapshot,
      regulatorySnapshot
    )
    return this
  }
  reqMktDepth(tickerId, contract, numRows) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    assert(Number.isInteger(numRows), '"numRows" must be an integer - ' + numRows)
    this._sendRequest('reqMktDepth', tickerId, contract, numRows)
    return this
  }
  reqNewsBulletins(allMsgs) {
    assert(typeof allMsgs === 'boolean', '"allMsgs" must be a boolean - ' + allMsgs)
    this._sendRequest('reqNewsBulletins', allMsgs)
    return this
  }
  reqOpenOrders() {
    this._sendRequest('reqOpenOrders')
    return this
  }
  reqPositions() {
    this._sendRequest('reqPositions')
    return this
  }
  // input params account here is acctCode, we name it account to be consistent with IB document
  reqPositionsMulti(reqId, account, modelCode) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof account === 'string', '"account" must be a string - ' + account)
    assert(
      typeof modelCode === 'string' || typeof modelCode === 'object',
      '"modelCode" must be a string or null - ' + modelCode
    )
    this._sendRequest('reqPositionsMulti', reqId, account, modelCode)
    return this
  }
  reqRealTimeBars(tickerId, contract, barSize, whatToShow, useRTH) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    assert(Number.isInteger(barSize), '"barSize" must be an integer - ' + barSize)
    assert(typeof whatToShow === 'string', '"whatToShow" must be a string - ' + whatToShow)
    assert(typeof useRTH === 'boolean', '"useRTH" must be a boolean - ' + useRTH)
    this._sendRequest('reqRealTimeBars', tickerId, contract, barSize, whatToShow, useRTH)
    return this
  }
  reqScannerParameters() {
    this._sendRequest('reqScannerParameters')
    return this
  }
  reqScannerSubscription(tickerId, subscription) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    this._sendRequest('reqScannerSubscription', tickerId, subscription)
    return this
  }
  requestFA(faDataType) {
    assert(Number.isInteger(faDataType), '"faDataType" must be an integer - ' + faDataType)
    this._sendRequest('requestFA', faDataType)
    return this
  }
  setServerLogLevel(logLevel) {
    assert(Number.isInteger(logLevel), '"logLevel" must be an integer - ' + logLevel)
    this._sendRequest('setServerLogLevel', logLevel)
    return this
  }
  queryDisplayGroups(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendRequest('queryDisplayGroups', reqId)
    return this
  }
  updateDisplayGroup(reqId, contractInfo) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof contractInfo === 'string', '"contractInfo" must be an string - ' + contractInfo)
    this._sendRequest('updateDisplayGroup', reqId, contractInfo)
    return this
  }
  subscribeToGroupEvents(reqId, groupId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof groupId === 'string', '"groupId" must be an integer - ' + groupId)
    this._sendRequest('subscribeToGroupEvents', reqId, groupId)
    return this
  }
  unsubscribeToGroupEvents(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendRequest('unsubscribeToGroupEvents', reqId)
    return this
  }

  saveTick(ticker, tickType, value) {
    switch (tickType) {
      case 0:
        if (!ticker.size) ticker.size = {}
        ticker['size']['bid'] = value
        break
      case 1:
        if (!ticker.price) ticker.price = {}
        ticker['price']['bid'] = value
        break
      case 2:
        if (!ticker.price) ticker.price = {}
        ticker['price']['ask'] = value
        break
      case 3:
        if (!ticker.size) ticker.size = {}
        ticker['size']['ask'] = value
        break
      case 4:
        if (!ticker.price) ticker.price = {}
        ticker['price']['last'] = value
        break
      case 5:
        if (!ticker.size) ticker.size = {}
        ticker['size']['last'] = value
        break
      case 6:
        if (!ticker.price) ticker.price = {}
        ticker['price']['high'] = value
        break
      case 7:
        if (!ticker.price) ticker.price = {}
        ticker['price']['low'] = value
        break
      case 8:
        ticker['volume'] = value
        break
      case 9:
        if (!ticker.price) ticker.price = {}
        ticker['price']['close'] = value
        break
      case 10:
        this._saveTickOption(ticker, 'bid', value)
        break
      case 11:
        this._saveTickOption(ticker, 'ask', value)
        break
      case 12:
        this._saveTickOption(ticker, 'last', value)
        break
      case 13:
        this._saveTickOption(ticker, 'model', value)
        break
      case 14:
        if (!ticker.price) ticker.price = {}
        ticker['price']['open'] = value
        break
      // TODO 15-20 needs implementation
      case 21:
        ticker['avgVolume'] = value
        break
      case 22:
        ticker['openInterest'] = value
        break
      case 23:
        ticker['optionHV'] = value
        break
      case 24:
        ticker['optionIV'] = value
        break
      // TODO 25-36 needs implementation
      case 37:
        if (!ticker.price) ticker.price = {}
        ticker['price']['mark'] = value
        break
      // TODO 38-44 needs implementation
      case 45:
        ticker['lastTimestamp'] = value
        break
      case 46:
        ticker['shortable'] = value
        break
      // TODO 47-48 needs implementation
      case 49:
        ticker['halted'] = value
        break
      case 50:
        if (!ticker.yield) ticker.yield = {}
        ticker['yield']['bid'] = value
        break
      case 51:
        if (!ticker.yield) ticker.yield = {}
        ticker['yield']['ask'] = value
        break
      case 52:
        if (!ticker.yield) ticker.yield = {}
        ticker['yield']['last'] = value
        break
      // TODO 53-83 needs implementation
      case 86:
        ticker.futuresOpenInterest = value
        break
      default:
        break
    }
  }

  _saveTickOption(ticker, prefix, values) {
    if (!ticker.delta) ticker.delta = {}
    if (!ticker.gamma) ticker.gamma = {}
    if (!ticker.iv) ticker.iv = {}
    if (!ticker.price) ticker.price = {}
    if (!ticker.dividend) ticker.dividend = {}
    if (!ticker.theta) ticker.theta = {}
    if (!ticker.underlyingPrice) ticker.underlyingPrice = {}
    if (!ticker.vega) ticker.vega = {}

    ticker['delta'][prefix] = values.delta
    ticker['gamma'][prefix] = values.gamma
    ticker['iv'][prefix] = values.impliedVolatility
    ticker['price'][prefix] = values.optPrice
    ticker['dividend'][prefix] = values.pvDividend
    ticker['theta'][prefix] = values.theta
    ticker['underlyingPrice'][prefix] = values.undPrice
    ticker['vega'][prefix] = values.vega
  }

  _initSocket(socket) {
    socket
      .onError(err => this.emit('error', err))
      .onConnected(() => this.emit('connected'))
      .onServerData(({ serverVersion }) => {
        this._messageEncoder.setServerVersion(serverVersion)
        this._messageDecoder.setServerVersion(serverVersion)
      })
      .onResponse(data => {
        this._receiveResponse(data)
        this.emit('received', data)
      })
      .onClose(err => this.emit('disconnected', err))

    return socket
  }

  _sendRequest() {
    this._messageEncoder.sendMessage(this._messageEncoder.encodeMessage(...arguments))
  }

  _receiveResponse(response) {
    this._messageDecoder.receiveMessage(response)
    this._messageDecoder.decodeMessage()
  }
}
export default IBClient
