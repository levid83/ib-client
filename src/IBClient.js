import assert, { fail } from 'assert'
import { EventEmitter } from 'events'

import { CLIENT_VERSION } from './constants'
import Socket from './Socket'
import Queue from './Queue'
import MessageEncoder from './MessageEncoder'
import MessageDecoder from './MessageDecoder'

import { BROKER_ERRORS } from './errors'

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
    this._queue = new Queue({ eventHandler: this, socket: this._socket })
    this._messageEncoder = new MessageEncoder({
      eventHandler: this
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
    let message = this._messageEncoder.encodeMessage({}, 'sendClientVersion', CLIENT_VERSION)
    this._sendMessage(message)
    return this
  }

  sendClientId() {
    assert(Number.isInteger(this._clientId), '"clientId" must be an integer - ' + this._clientId)
    let message = this._messageEncoder.encodeMessage({}, 'sendClientId', this._clientId)
    this._sendMessage(message)
    return this
  }

  cancelScannerSubscription(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    let message = this._messageEncoder.encodeMessage(
      { id: tickerId, error: BROKER_ERRORS.FAIL_SEND_CANSCANNER },
      'cancelScannerSubscription',
      tickerId
    )
    this._sendMessage(message)
    return this
  }

  reqScannerParameters() {
    let message = this._messageEncoder.encodeMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_REQSCANNERPARAMETERS
      },
      'reqScannerParameters'
    )
    this._sendMessage(message)
    return this
  }

  reqScannerSubscription(
    tickerId,
    subscription,
    scannerSubscriptionOptions,
    scannerSubscriptionFilterOptions
  ) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.UPDATE_TWS
      },
      'reqScannerSubscription',
      tickerId,
      subscription,
      scannerSubscriptionOptions,
      scannerSubscriptionFilterOptions
    )
    this._sendMessage(message)
    return this
  }

  reqMktData(tickerId, contract, genericTickList, snapshot, regulatorySnapshot, mktDataOptions) {
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
    let message = this._messageEncoder.encodeMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_REQMKT
      },
      'reqMktData',
      tickerId,
      contract,
      genericTickList,
      snapshot,
      regulatorySnapshot,
      mktDataOptions
    )
    this._sendMessage(message)
    return this
  }

  cancelHistoricalData(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_CANHISTDATA
      },
      'cancelHistoricalData',
      tickerId
    )
    this._sendMessage(message)
    return this
  }

  cancelRealTimeBars(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_CANRTBARS
      },
      'cancelRealTimeBars',
      tickerId
    )
    this._sendMessage(message)
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
    keepUpToDate,
    chartOptions
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
    let message = this._messageEncoder.encodeMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_REQHISTDATA
      },
      'reqHistoricalData',
      tickerId,
      contract,
      endDateTime,
      durationStr,
      barSizeSetting,
      whatToShow,
      useRTH,
      formatDate,
      keepUpToDate,
      chartOptions
    )
    this._sendMessage(message)
    return this
  }

  reqHeadTimestamp(reqId, contract, whatToShow, useRTH, formatDate) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof whatToShow === 'string', '"whatToShow" must be a string - ' + whatToShow)
    assert(Number.isInteger(useRTH), '"useRTH" must be an integer - ' + useRTH)
    assert(Number.isInteger(formatDate), '"formatDate" must be an integer - ' + formatDate)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQHEADTIMESTAMP
      },
      'reqHeadTimestamp',
      reqId,
      contract,
      whatToShow,
      useRTH,
      formatDate
    )
    this._sendMessage(message)
    return this
  }

  cancelHeadTimestamp(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANHEADTIMESTAMP
      },
      'cancelHeadTimestamp',
      reqId
    )
    this._sendMessage(message)
    return this
  }

  reqRealTimeBars(tickerId, contract, barSize, whatToShow, useRTH, realTimeBarsOptions) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    assert(Number.isInteger(barSize), '"barSize" must be an integer - ' + barSize)
    assert(typeof whatToShow === 'string', '"whatToShow" must be a string - ' + whatToShow)
    assert(typeof useRTH === 'boolean', '"useRTH" must be a boolean - ' + useRTH)
    let message = this._messageEncoder.encodeMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_REQRTBARS
      },
      'reqRealTimeBars',
      tickerId,
      contract,
      barSize,
      whatToShow,
      useRTH,
      realTimeBarsOptions
    )
    this._sendMessage(message)
    return this
  }

  reqContractDetails(reqId, contract) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQCONTRACT
      },
      'reqContractDetails',
      reqId,
      contract
    )
    this._sendMessage(message)
    return this
  }

  reqMktDepth(tickerId, contract, numRows, isSmartDepth, mktDepthOptions) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    assert(Number.isInteger(numRows), '"numRows" must be an integer - ' + numRows)
    assert(typeof isSmartDepth === 'boolean', '"isSmartDepth" must be a boolean - ' + isSmartDepth)

    let message = this._messageEncoder.encodeMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_REQMKTDEPTH
      },
      'reqMktDepth',
      tickerId,
      contract,
      numRows,
      isSmartDepth,
      mktDepthOptions
    )
    this._sendMessage(message)
    return this
  }

  cancelMktData(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_CANMKT
      },
      'cancelMktData',
      tickerId
    )
    this._sendMessage(message)
    return this
  }

  cancelMktDepth(tickerId, isSmartDepth) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    assert(typeof isSmartDepth === 'boolean', '"isSmartDepth" must be a boolean - ' + isSmartDepth)

    let message = this._messageEncoder.encodeMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_CANMKTDEPTH
      },
      'cancelMktDepth',
      tickerId
    )
    this._sendMessage(message)
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
    let message = this._messageEncoder.encodeMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_REQMKT
      },
      'exerciseOptions',
      tickerId,
      contract,
      exerciseAction,
      exerciseQuantity,
      account,
      override
    )
    this._sendMessage(message)
    return this
  }

  placeOrder(id, contract, order) {
    assert(Number.isInteger(id), '"id" must be an integer - ' + id)
    let message = this._messageEncoder.encodeMessage(
      {
        id: id,
        error: BROKER_ERRORS.FAIL_SEND_ORDER
      },
      'placeOrder',
      id,
      contract,
      order
    )
    this._sendMessage(message)
    return this
  }

  reqAccountUpdates(subscribe, acctCode) {
    assert(typeof subscribe === 'boolean', '"subscribe" must be a boolean - ' + subscribe)
    assert(typeof acctCode === 'string', '"acctCode" must be a string - ' + acctCode)
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_ACCT
      },
      'reqAccountUpdates',
      subscribe,
      acctCode
    )
    this._sendMessage(message)
    return this
  }

  reqExecutions(reqId, filter) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_EXEC
      },
      'reqExecutions',
      reqId,
      filter
    )
    this._sendMessage(message)
    return this
  }

  cancelOrder(id) {
    assert(Number.isInteger(id), '"id" must be an integer - ' + id)
    let message = this._messageEncoder.encodeMessage(
      {
        id: id,
        error: BROKER_ERRORS.FAIL_SEND_CORDER
      },
      'cancelOrder',
      id
    )
    this._sendMessage(message)
    return this
  }

  reqOpenOrders() {
    let message = this._messageEncoder.encodeMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_OORDER
      },
      'reqOpenOrders'
    )
    this._sendMessage(message)
    return this
  }

  reqIds(numIds) {
    assert(Number.isInteger(numIds), '"numIds" must be an integer - ' + numIds)
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_CORDER
      },
      'reqIds',
      numIds
    )
    this._sendMessage(message)
    return this
  }

  reqNewsBulletins(allMsgs) {
    assert(typeof allMsgs === 'boolean', '"allMsgs" must be a boolean - ' + allMsgs)
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_CORDER
      },
      'reqNewsBulletins',
      allMsgs
    )
    this._sendMessage(message)
    return this
  }

  cancelNewsBulletins() {
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_CORDER
      },
      'cancelNewsBulletins'
    )
    this._sendMessage(message)
    return this
  }

  setServerLogLevel(logLevel) {
    assert(Number.isInteger(logLevel), '"logLevel" must be an integer - ' + logLevel)
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_SERVER_LOG_LEVEL
      },
      'setServerLogLevel',
      logLevel
    )
    this._sendMessage(message)
    return this
  }

  reqAutoOpenOrders(bAutoBind) {
    assert(typeof bAutoBind === 'boolean', '"bAutoBind" must be a boolean - ' + bAutoBind)
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_OORDER
      },
      'reqAutoOpenOrders',
      bAutoBind
    )
    this._sendMessage(message)
    return this
  }

  reqAllOpenOrders() {
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_OORDER
      },
      'reqAllOpenOrders'
    )
    this._sendMessage(message)
    return this
  }

  reqManagedAccts() {
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_OORDER
      },
      'reqManagedAccts'
    )
    this._sendMessage(message)
    return this
  }

  requestFA(faDataType) {
    assert(Number.isInteger(faDataType), '"faDataType" must be an integer - ' + faDataType)
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_FA_REQUEST
      },
      'requestFA',
      faDataType
    )
    this._sendMessage(message)
    return this
  }

  replaceFA(faDataType, xml) {
    assert(Number.isInteger(faDataType), '"faDataType" must be an integer - ' + faDataType)
    assert(typeof xml === 'string', '"xml" must be a string - ' + xml)
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_FA_REPLACE
      },
      'replaceFA',
      faDataType,
      xml
    )
    this._sendMessage(message)
    return this
  }

  reqCurrentTime() {
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQCURRTIME
      },
      'reqCurrentTime'
    )
    this._sendMessage(message)
    return this
  }

  reqFundamentalData(reqId, contract, reportType, fundamentalDataOptions = null) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof reportType === 'string', '"reportType" must be a string - ' + reportType)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQFUNDDATA
      },
      'reqFundamentalData',
      reqId,
      contract,
      reportType,
      fundamentalDataOptions
    )
    this._sendMessage(message)
    return this
  }

  cancelFundamentalData(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: FAIL_SEND_CANFUNDDATA
      },
      'cancelFundamentalData',
      reqId
    )
    this._sendMessage(message)
    return this
  }

  calculateImpliedVolatility(
    reqId,
    contract,
    optionPrice,
    underPrice,
    impliedVolatilityOptions = null
  ) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQCALCIMPLIEDVOLAT
      },
      'calculateImpliedVolatility',
      reqId,
      contract,
      optionPrice,
      underPrice,
      impliedVolatilityOptions
    )
    this._sendMessage(message)
    return this
  }

  cancelCalculateImpliedVolatility(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANCALCIMPLIEDVOLAT
      },
      'cancelCalculateImpliedVolatility',
      reqId
    )
    this._sendMessage(message)
    return this
  }

  calculateOptionPrice(reqId, contract, volatility, underPrice, optionPriceOptions = null) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQCALCOPTIONPRICE
      },
      'calculateOptionPrice',
      reqId,
      contract,
      volatility,
      underPrice,
      optionPriceOptions
    )
    this._sendMessage(message)
    return this
  }

  cancelCalculateOptionPrice(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANCALCOPTIONPRICE
      },
      'cancelCalculateOptionPrice',
      reqId
    )
    this._sendMessage(message)
    return this
  }

  reqGlobalCancel() {
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQGLOBALCANCEL
      },
      'reqGlobalCancel'
    )
    this._sendMessage(message)
    return this
  }

  reqMarketDataType(marketDataType) {
    assert(
      Number.isInteger(marketDataType),
      '"marketDataType" must be an integer - ' + marketDataType
    )
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQMARKETDATATYPE
      },
      'reqMarketDataType',
      marketDataType
    )
    this._sendMessage(message)
    return this
  }

  reqPositions() {
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQPOSITIONS
      },
      'reqPositions'
    )
    this._sendMessage(message)
    return this
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
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQSECDEFOPTPARAMS
      },
      'reqSecDefOptParams',
      reqId,
      underlyingSymbol,
      futFopExchange,
      underlyingSecType,
      underlyingConId
    )
    this._sendMessage(message)
    return this
  }

  reqSoftDollarTiers(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQSOFTDOLLARTIERS
      },
      'reqSoftDollarTiers',
      reqId
    )
    this._sendMessage(message)
    return this
  }

  cancelPositions() {
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_CANPOSITIONS
      },
      'cancelPositions'
    )
    this._sendMessage(message)
    return this
  }

  reqPositionsMulti(reqId, account, modelCode) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof account === 'string', '"account" must be a string - ' + account)
    assert(
      typeof modelCode === 'string' || typeof modelCode === 'object',
      '"modelCode" must be a string or null - ' + modelCode
    )
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQPOSITIONSMULTI
      },
      'reqPositionsMulti',
      reqId,
      account,
      modelCode
    )
    this._sendMessage(message)
    return this
  }

  cancelPositionsMulti(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANPOSITIONSMULTI
      },
      'cancelPositionsMulti',
      reqId
    )
    this._sendMessage(message)
    return this
  }

  cancelAccountUpdatesMulti(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANACCOUNTUPDATESMULTI
      },
      'cancelAccountUpdatesMulti',
      reqId
    )
    this._sendMessage(message)
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
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQACCOUNTUPDATESMULTI
      },
      'reqAccountUpdatesMulti',
      reqId,
      acctCode,
      modelCode,
      ledgerAndNLV
    )
    this._sendMessage(message)
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
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQACCOUNTDATA
      },
      'reqAccountSummary',
      reqId,
      group,
      tags
    )
    this._sendMessage(message)
    return this
  }

  cancelAccountSummary(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANACCOUNTDATA
      },
      'cancelAccountSummary',
      reqId
    )
    this._sendMessage(message)
    return this
  }

  verifyRequest(apiName, apiVersion) {
    assert(typeof apiName === 'string', '"apiName" must be a string - ' + apiName)
    assert(typeof apiVersion === 'string', '"apiVersion" must be a string - ' + apiVersion)

    let message = this._messageEncoder.encodeMessage(
      {
        id: EClientErrors.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_VERIFYREQUEST
      },
      'verifyRequest',
      apiName,
      apiVersion
    )

    this._sendMessage(message)
    return this
  }

  verifyMessage(apiData) {
    assert(typeof apiData === 'string', '"apiData" must be a string - ' + apiData)

    let message = this._messageEncoder.encodeMessage(
      {
        id: EClientErrors.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_VERIFYMESSAGE
      },
      'verifyMessage',
      apiData
    )

    this._sendMessage(message)
    return this
  }

  verifyAndAuthRequest(apiName, apiVersion, opaqueIsvKey) {
    assert(typeof apiName === 'string', '"apiName" must be a string - ' + apiName)
    assert(typeof apiVersion === 'string', '"apiVersion" must be a string - ' + apiVersion)
    assert(typeof opaqueIsvKey === 'string', '"opaqueIsvKey" must be a string - ' + opaqueIsvKey)

    let message = this._messageEncoder.encodeMessage(
      {
        id: EClientErrors.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_VERIFYANDAUTHREQUEST
      },
      'verifyAndAuthRequest',
      apiName,
      apiVersion,
      opaqueIsvKey
    )

    this._sendMessage(message)
    return this
  }

  verifyAndAuthMessage(apiData, xyzResponse) {
    assert(typeof apiData === 'string', '"apiData" must be a string - ' + apiData)
    assert(typeof xyzResponse === 'string', '"xyzResponse" must be a string - ' + xyzResponse)

    let message = this._messageEncoder.encodeMessage(
      {
        id: EClientErrors.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_VERIFYANDAUTHMESSAGE
      },
      'verifyAndAuthMessage',
      apiData,
      xyzResponse
    )

    this._sendMessage(message)
    return this
  }

  queryDisplayGroups(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_QUERYDISPLAYGROUPS
      },
      'queryDisplayGroups',
      reqId
    )
    this._sendMessage(message)
    return this
  }

  subscribeToGroupEvents(reqId, groupId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof groupId === 'string', '"groupId" must be an integer - ' + groupId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_SUBSCRIBETOGROUPEVENTS
      },
      'subscribeToGroupEvents',
      reqId,
      groupId
    )
    this._sendMessage(message)
    return this
  }

  updateDisplayGroup(reqId, contractInfo) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof contractInfo === 'string', '"contractInfo" must be an string - ' + contractInfo)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_UPDATEDISPLAYGROUP
      },
      'updateDisplayGroup',
      reqId,
      contractInfo
    )
    this._sendMessage(message)
    return this
  }

  unsubscribeFromGroupEvents(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_UNSUBSCRIBEFROMGROUPEVENTS
      },
      'unsubscribeToGroupEvents',
      reqId
    )
    this._sendMessage(message)
    return this
  }

  reqMatchingSymbols(reqId, pattern) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof pattern === 'string', '"pattern" must be a string - ' + pattern)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQMATCHINGSYMBOLS
      },
      'reqMatchingSymbols',
      reqId,
      pattern
    )
    this._sendMessage(message)
  }

  reqFamilyCodes() {
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQFAMILYCODES
      },
      'reqFamilyCodes',
      reqId,
      pattern
    )
    this._sendMessage(message)
  }

  reqMktDepthExchanges() {
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQMKTDEPTHEXCHANGES
      },
      'reqMktDepthExchanges'
    )
    this._sendMessage(message)
  }

  reqSmartComponents(reqId, bboExchange) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof bboExchange === 'string', '"bboExchange" must be a string - ' + bboExchange)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQSMARTCOMPONENTS
      },
      'reqSmartComponents',
      reqId,
      bboExchange
    )
    this._sendMessage(message)
  }

  reqNewsProviders() {
    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQNEWSPROVIDERS
      },
      'reqNewsProviders'
    )
    this._sendMessage(message)
  }

  reqNewsArticle(reqId, providerCode, articleId = null, newsArticleOptions) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof providerCode === 'string', '"providerCode" must be a string - ' + providerCode)
    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQNEWSARTICLE
      },
      'reqNewsArticle',
      reqId,
      providerCode,
      articleId,
      newsArticleOptions
    )
    this._sendMessage(message)
  }

  reqHistoricalNews(
    reqId,
    conId,
    providerCode,
    startDateTime,
    endDateTime,
    totalResults,
    historicalNewsOptions = null
  ) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(Number.isInteger(conId), '"conId" must be an integer - ' + conId)

    assert(typeof providerCode === 'string', '"providerCode" must be a string - ' + providerCode)
    assert(typeof startDateTime === 'string', '"startDateTime" must be a string - ' + providerCode)
    assert(typeof endDateTime === 'string', '"endDateTime" must be a string - ' + providerCode)
    assert(Number.isInteger(totalResults), '"totalResults" must be an integer - ' + totalResults)

    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQHISTORICALNEWS
      },
      'reqHistoricalNews',
      reqId,
      conId,
      providerCode,
      startDateTime,
      endDateTime,
      totalResults,
      historicalNewsOptions
    )
    this._sendMessage(message)
  }

  reqHistogramData(reqId, contract, useRTH, timePeriod) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof useRTH === 'boolean', '"useRTH" must be an boolean - ' + useRTH)
    assert(typeof timePeriod === 'string', '"timePeriod" must be a string - ' + timePeriod)

    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQHISTDATA
      },
      'reqHistogramData',
      reqId,
      contract,
      useRTH,
      timePeriod
    )
    this._sendMessage(message)
  }

  cancelHistogramData(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)

    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANHISTDATA
      },
      'cancelHistogramData',
      reqId
    )
    this._sendMessage(message)
  }

  reqMarketRule(marketRuleId) {
    assert(Number.isInteger(marketRuleId), '"marketRuleId" must be an integer - ' + marketRuleId)

    let message = this._messageEncoder.encodeMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQMARKETRULE
      },
      'reqMarketRule',
      marketRuleId
    )
    this._sendMessage(message)
  }

  reqPnL(reqId, account, modelCode) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof account === 'string', '"account" must be a string - ' + account)
    assert(typeof modelCode === 'string', '"modelCode" must be a string - ' + modelCode)

    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQPNL
      },
      'reqPnL',
      reqId,
      account,
      modelCode
    )
    this._sendMessage(message)
  }

  cancelPnL(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)

    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANPNL
      },
      'reqPnL',
      reqId
    )
    this._sendMessage(message)
  }

  reqPnLSingle(reqId, account, modelCode, conId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof account === 'string', '"account" must be a string - ' + account)
    assert(typeof modelCode === 'string', '"modelCode" must be a string - ' + modelCode)
    assert(Number.isInteger(conId), '"conId" must be an integer - ' + conId)

    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQPNL_SINGLE
      },
      'reqPnLSingle',
      reqId,
      account,
      modelCode,
      conId
    )
    this._sendMessage(message)
  }

  cancelPnLSingle(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)

    let message = this._messageEncoder.encodeMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANPNL_SINGLE
      },
      'cancelPnLSingle',
      reqId
    )
    this._sendMessage(message)
  }

  reqHistoricalTicks(
    tickerId,
    contract,
    startDateTime,
    endDateTime,
    numberOfTicks,
    whatToShow,
    useRTH,
    ignoreSize,
    miscOptions
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
    let message = this._messageEncoder.encodeMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_HISTORICAL_TICK
      },
      'reqHistoricalTicks',
      tickerId,
      contract,
      startDateTime,
      endDateTime,
      numberOfTicks,
      whatToShow,
      useRTH,
      ignoreSize,
      miscOptions
    )
    this._sendMessage(message)
    return this
  }

  reqTickByTickData(tickerId, contract, tickType, numberOfTicks, ignoreSize) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    assert(typeof tickType === 'string', '"tickType" must be a string - ' + tickType)
    assert(Number.isInteger(numberOfTicks), '"numberOfTicks" must be a number - ' + numberOfTicks)
    assert(typeof ignoreSize === 'boolean', '"ignoreSize" must be an boolean - ' + ignoreSize)
    let message = this._messageEncoder.encodeMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_REQTICKBYTICK
      },
      'reqTickByTickData',
      tickerId,
      contract,
      tickType,
      numberOfTicks,
      ignoreSize
    )
    this._sendMessage(message)
    return this
  }

  cancelTickByTickData(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    let message = this._messageEncoder.encodeMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_CANTICKBYTICK
      },
      'cancelTickByTickData',
      tickerId
    )
    this._sendMessage(message)
    return this
  }

  // --------

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

  _sendMessage(message) {
    this._queue.push(message)
  }

  _receiveResponse(response) {
    this._messageDecoder.receiveMessage(response)
    this._messageDecoder.decodeMessage()
  }
}
export default IBClient
