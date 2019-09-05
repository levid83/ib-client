import assert, { fail } from 'assert'
import { EventEmitter } from 'events'
import Socket from './Socket'
import OutboundQueue from './OutboundQueue'
import InboundQueue from './InboundQueue'
import MessageEncoder from './MessageEncoder'
import MessageDecoder from './MessageDecoder'

import { BROKER_ERRORS } from './errors'

class IBClient extends EventEmitter {
  constructor(options = { socket: null, clientId: null }) {
    super()
    this._clientId = options.clientId
    this._socket = this._initSocket(new Socket(options.socket))

    this._messageEncoder = new MessageEncoder({
      eventHandler: this
    })

    this._messageDecoder = new MessageDecoder({
      eventHandler: this
    })

    this._outboundQueue = new OutboundQueue({
      eventHandler: this,
      encoder: this._messageEncoder,
      socket: this._socket
    })
    this._inboundQueue = new InboundQueue({
      eventHandler: this,
      decoder: this._messageDecoder,
      socket: this._socket
    })

    this.on('server', ({ serverVersion }) => {
      this._messageEncoder.setServerVersion(serverVersion)
      this._messageDecoder.setServerVersion(serverVersion)
      this.startAPI()
    })
  }

  _initSocket(socket) {
    socket
      .onError(err => this.emit('error', err))
      .onConnected(() => this.emit('connected'))
      .onClose(err => this.emit('disconnected', err))
    return socket
  }

  _sendMessage() {
    let message = Array.from(arguments)
    this._outboundQueue.push(message).on('failure', err => this.emit('error', err))
  }

  connect() {
    this._socket.connect(() => this.sendV100APIHeader())
    return this
  }
  disconnect() {
    this.schedule('disconnect')
    return this
  }

  sendV100APIHeader() {
    let message = this._messageEncoder.sendV100APIHeader()
    this._socket.write(message, () => {})
  }

  startAPI() {
    this._sendMessage(
      { id: BROKER_ERRORS.NO_VALID_ID, error: BROKER_ERRORS.FAIL_SEND_STARTAPI },
      'startAPI',
      this._clientId,
      '' // optionalCapabilities
    )

    return this
  }

  cancelScannerSubscription(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    this._sendMessage(
      { id: tickerId, error: BROKER_ERRORS.FAIL_SEND_CANSCANNER },
      'cancelScannerSubscription',
      tickerId
    )

    return this
  }

  reqScannerParameters() {
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQSCANNERPARAMETERS
      },
      'reqScannerParameters'
    )

    return this
  }

  reqScannerSubscription(
    tickerId,
    subscription,
    scannerSubscriptionOptions,
    scannerSubscriptionFilterOptions
  ) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    this._sendMessage(
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
    this._sendMessage(
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

    return this
  }

  cancelHistoricalData(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    this._sendMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_CANHISTDATA
      },
      'cancelHistoricalData',
      tickerId
    )

    return this
  }

  cancelRealTimeBars(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    this._sendMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_CANRTBARS
      },
      'cancelRealTimeBars',
      tickerId
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
    this._sendMessage(
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

    return this
  }

  reqHeadTimestamp(reqId, contract, whatToShow, useRTH, formatDate) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof whatToShow === 'string', '"whatToShow" must be a string - ' + whatToShow)
    assert(Number.isInteger(useRTH), '"useRTH" must be an integer - ' + useRTH)
    assert(Number.isInteger(formatDate), '"formatDate" must be an integer - ' + formatDate)
    this._sendMessage(
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

    return this
  }

  cancelHeadTimestamp(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANHEADTIMESTAMP
      },
      'cancelHeadTimestamp',
      reqId
    )

    return this
  }

  reqRealTimeBars(tickerId, contract, barSize, whatToShow, useRTH, realTimeBarsOptions) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    assert(Number.isInteger(barSize), '"barSize" must be an integer - ' + barSize)
    assert(typeof whatToShow === 'string', '"whatToShow" must be a string - ' + whatToShow)
    assert(typeof useRTH === 'boolean', '"useRTH" must be a boolean - ' + useRTH)
    this._sendMessage(
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

    return this
  }

  reqContractDetails(reqId, contract) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQCONTRACT
      },
      'reqContractDetails',
      reqId,
      contract
    )

    return this
  }

  reqMktDepth(tickerId, contract, numRows, isSmartDepth, mktDepthOptions) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    assert(Number.isInteger(numRows), '"numRows" must be an integer - ' + numRows)
    assert(typeof isSmartDepth === 'boolean', '"isSmartDepth" must be a boolean - ' + isSmartDepth)

    this._sendMessage(
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

    return this
  }

  cancelMktData(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    this._sendMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_CANMKT
      },
      'cancelMktData',
      tickerId
    )

    return this
  }

  cancelMktDepth(tickerId, isSmartDepth) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    assert(typeof isSmartDepth === 'boolean', '"isSmartDepth" must be a boolean - ' + isSmartDepth)

    this._sendMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_CANMKTDEPTH
      },
      'cancelMktDepth',
      tickerId
    )

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
    this._sendMessage(
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

    return this
  }

  placeOrder(id, contract, order) {
    assert(Number.isInteger(id), '"id" must be an integer - ' + id)
    this._sendMessage(
      {
        id: id,
        error: BROKER_ERRORS.FAIL_SEND_ORDER
      },
      'placeOrder',
      id,
      contract,
      order
    )

    return this
  }

  reqAccountUpdates(subscribe, acctCode) {
    assert(typeof subscribe === 'boolean', '"subscribe" must be a boolean - ' + subscribe)
    assert(typeof acctCode === 'string', '"acctCode" must be a string - ' + acctCode)
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_ACCT
      },
      'reqAccountUpdates',
      subscribe,
      acctCode
    )

    return this
  }

  reqExecutions(reqId, filter) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_EXEC
      },
      'reqExecutions',
      reqId,
      filter
    )

    return this
  }

  cancelOrder(id) {
    assert(Number.isInteger(id), '"id" must be an integer - ' + id)
    this._sendMessage(
      {
        id: id,
        error: BROKER_ERRORS.FAIL_SEND_CORDER
      },
      'cancelOrder',
      id
    )

    return this
  }

  reqOpenOrders() {
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_OORDER
      },
      'reqOpenOrders'
    )

    return this
  }

  reqIds(numIds) {
    assert(Number.isInteger(numIds), '"numIds" must be an integer - ' + numIds)
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_CORDER
      },
      'reqIds',
      numIds
    )

    return this
  }

  reqNewsBulletins(allMsgs) {
    assert(typeof allMsgs === 'boolean', '"allMsgs" must be a boolean - ' + allMsgs)
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_CORDER
      },
      'reqNewsBulletins',
      allMsgs
    )

    return this
  }

  cancelNewsBulletins() {
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_CORDER
      },
      'cancelNewsBulletins'
    )

    return this
  }

  setServerLogLevel(logLevel) {
    assert(Number.isInteger(logLevel), '"logLevel" must be an integer - ' + logLevel)
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_SERVER_LOG_LEVEL
      },
      'setServerLogLevel',
      logLevel
    )

    return this
  }

  reqAutoOpenOrders(bAutoBind) {
    assert(typeof bAutoBind === 'boolean', '"bAutoBind" must be a boolean - ' + bAutoBind)
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_OORDER
      },
      'reqAutoOpenOrders',
      bAutoBind
    )

    return this
  }

  reqAllOpenOrders() {
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_OORDER
      },
      'reqAllOpenOrders'
    )

    return this
  }

  reqManagedAccts() {
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_OORDER
      },
      'reqManagedAccts'
    )

    return this
  }

  requestFA(faDataType) {
    assert(Number.isInteger(faDataType), '"faDataType" must be an integer - ' + faDataType)
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_FA_REQUEST
      },
      'requestFA',
      faDataType
    )

    return this
  }

  replaceFA(faDataType, xml) {
    assert(Number.isInteger(faDataType), '"faDataType" must be an integer - ' + faDataType)
    assert(typeof xml === 'string', '"xml" must be a string - ' + xml)
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_FA_REPLACE
      },
      'replaceFA',
      faDataType,
      xml
    )

    return this
  }

  reqCurrentTime() {
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQCURRTIME
      },
      'reqCurrentTime'
    )

    return this
  }

  reqFundamentalData(reqId, contract, reportType, fundamentalDataOptions = null) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof reportType === 'string', '"reportType" must be a string - ' + reportType)
    this._sendMessage(
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

    return this
  }

  cancelFundamentalData(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendMessage(
      {
        id: reqId,
        error: FAIL_SEND_CANFUNDDATA
      },
      'cancelFundamentalData',
      reqId
    )

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
    this._sendMessage(
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

    return this
  }

  cancelCalculateImpliedVolatility(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANCALCIMPLIEDVOLAT
      },
      'cancelCalculateImpliedVolatility',
      reqId
    )

    return this
  }

  calculateOptionPrice(reqId, contract, volatility, underPrice, optionPriceOptions = null) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendMessage(
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

    return this
  }

  cancelCalculateOptionPrice(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANCALCOPTIONPRICE
      },
      'cancelCalculateOptionPrice',
      reqId
    )

    return this
  }

  reqGlobalCancel() {
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQGLOBALCANCEL
      },
      'reqGlobalCancel'
    )

    return this
  }

  reqMarketDataType(marketDataType) {
    assert(
      Number.isInteger(marketDataType),
      '"marketDataType" must be an integer - ' + marketDataType
    )
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQMARKETDATATYPE
      },
      'reqMarketDataType',
      marketDataType
    )

    return this
  }

  reqPositions() {
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQPOSITIONS
      },
      'reqPositions'
    )

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
    this._sendMessage(
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

    return this
  }

  reqSoftDollarTiers(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQSOFTDOLLARTIERS
      },
      'reqSoftDollarTiers',
      reqId
    )

    return this
  }

  cancelPositions() {
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_CANPOSITIONS
      },
      'cancelPositions'
    )

    return this
  }

  reqPositionsMulti(reqId, account, modelCode) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof account === 'string', '"account" must be a string - ' + account)
    assert(
      typeof modelCode === 'string' || typeof modelCode === 'object',
      '"modelCode" must be a string or null - ' + modelCode
    )
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQPOSITIONSMULTI
      },
      'reqPositionsMulti',
      reqId,
      account,
      modelCode
    )

    return this
  }

  cancelPositionsMulti(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANPOSITIONSMULTI
      },
      'cancelPositionsMulti',
      reqId
    )

    return this
  }

  cancelAccountUpdatesMulti(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANACCOUNTUPDATESMULTI
      },
      'cancelAccountUpdatesMulti',
      reqId
    )

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
    this._sendMessage(
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
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQACCOUNTDATA
      },
      'reqAccountSummary',
      reqId,
      group,
      tags
    )

    return this
  }

  cancelAccountSummary(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANACCOUNTDATA
      },
      'cancelAccountSummary',
      reqId
    )

    return this
  }

  verifyRequest(apiName, apiVersion) {
    assert(typeof apiName === 'string', '"apiName" must be a string - ' + apiName)
    assert(typeof apiVersion === 'string', '"apiVersion" must be a string - ' + apiVersion)

    this._sendMessage(
      {
        id: EClientErrors.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_VERIFYREQUEST
      },
      'verifyRequest',
      apiName,
      apiVersion
    )

    return this
  }

  verifyMessage(apiData) {
    assert(typeof apiData === 'string', '"apiData" must be a string - ' + apiData)

    this._sendMessage(
      {
        id: EClientErrors.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_VERIFYMESSAGE
      },
      'verifyMessage',
      apiData
    )

    return this
  }

  verifyAndAuthRequest(apiName, apiVersion, opaqueIsvKey) {
    assert(typeof apiName === 'string', '"apiName" must be a string - ' + apiName)
    assert(typeof apiVersion === 'string', '"apiVersion" must be a string - ' + apiVersion)
    assert(typeof opaqueIsvKey === 'string', '"opaqueIsvKey" must be a string - ' + opaqueIsvKey)

    this._sendMessage(
      {
        id: EClientErrors.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_VERIFYANDAUTHREQUEST
      },
      'verifyAndAuthRequest',
      apiName,
      apiVersion,
      opaqueIsvKey
    )

    return this
  }

  verifyAndAuthMessage(apiData, xyzResponse) {
    assert(typeof apiData === 'string', '"apiData" must be a string - ' + apiData)
    assert(typeof xyzResponse === 'string', '"xyzResponse" must be a string - ' + xyzResponse)

    this._sendMessage(
      {
        id: EClientErrors.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_VERIFYANDAUTHMESSAGE
      },
      'verifyAndAuthMessage',
      apiData,
      xyzResponse
    )

    return this
  }

  queryDisplayGroups(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_QUERYDISPLAYGROUPS
      },
      'queryDisplayGroups',
      reqId
    )

    return this
  }

  subscribeToGroupEvents(reqId, groupId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof groupId === 'string', '"groupId" must be an integer - ' + groupId)
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_SUBSCRIBETOGROUPEVENTS
      },
      'subscribeToGroupEvents',
      reqId,
      groupId
    )

    return this
  }

  updateDisplayGroup(reqId, contractInfo) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof contractInfo === 'string', '"contractInfo" must be an string - ' + contractInfo)
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_UPDATEDISPLAYGROUP
      },
      'updateDisplayGroup',
      reqId,
      contractInfo
    )

    return this
  }

  unsubscribeFromGroupEvents(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_UNSUBSCRIBEFROMGROUPEVENTS
      },
      'unsubscribeToGroupEvents',
      reqId
    )

    return this
  }

  reqMatchingSymbols(reqId, pattern) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof pattern === 'string', '"pattern" must be a string - ' + pattern)
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQMATCHINGSYMBOLS
      },
      'reqMatchingSymbols',
      reqId,
      pattern
    )
  }

  reqFamilyCodes() {
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQFAMILYCODES
      },
      'reqFamilyCodes',
      reqId,
      pattern
    )
  }

  reqMktDepthExchanges() {
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQMKTDEPTHEXCHANGES
      },
      'reqMktDepthExchanges'
    )
  }

  reqSmartComponents(reqId, bboExchange) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof bboExchange === 'string', '"bboExchange" must be a string - ' + bboExchange)
    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQSMARTCOMPONENTS
      },
      'reqSmartComponents',
      reqId,
      bboExchange
    )
  }

  reqNewsProviders() {
    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQNEWSPROVIDERS
      },
      'reqNewsProviders'
    )
  }

  reqNewsArticle(reqId, providerCode, articleId = null, newsArticleOptions) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof providerCode === 'string', '"providerCode" must be a string - ' + providerCode)
    this._sendMessage(
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

    this._sendMessage(
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
  }

  reqHistogramData(reqId, contract, useRTH, timePeriod) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof useRTH === 'boolean', '"useRTH" must be an boolean - ' + useRTH)
    assert(typeof timePeriod === 'string', '"timePeriod" must be a string - ' + timePeriod)

    this._sendMessage(
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
  }

  cancelHistogramData(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)

    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANHISTDATA
      },
      'cancelHistogramData',
      reqId
    )
  }

  reqMarketRule(marketRuleId) {
    assert(Number.isInteger(marketRuleId), '"marketRuleId" must be an integer - ' + marketRuleId)

    this._sendMessage(
      {
        id: BROKER_ERRORS.NO_VALID_ID,
        error: BROKER_ERRORS.FAIL_SEND_REQMARKETRULE
      },
      'reqMarketRule',
      marketRuleId
    )
  }

  reqPnL(reqId, account, modelCode) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof account === 'string', '"account" must be a string - ' + account)
    assert(typeof modelCode === 'string', '"modelCode" must be a string - ' + modelCode)

    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_REQPNL
      },
      'reqPnL',
      reqId,
      account,
      modelCode
    )
  }

  cancelPnL(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)

    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANPNL
      },
      'reqPnL',
      reqId
    )
  }

  reqPnLSingle(reqId, account, modelCode, conId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)
    assert(typeof account === 'string', '"account" must be a string - ' + account)
    assert(typeof modelCode === 'string', '"modelCode" must be a string - ' + modelCode)
    assert(Number.isInteger(conId), '"conId" must be an integer - ' + conId)

    this._sendMessage(
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
  }

  cancelPnLSingle(reqId) {
    assert(Number.isInteger(reqId), '"reqId" must be an integer - ' + reqId)

    this._sendMessage(
      {
        id: reqId,
        error: BROKER_ERRORS.FAIL_SEND_CANPNL_SINGLE
      },
      'cancelPnLSingle',
      reqId
    )
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
    this._sendMessage(
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

    return this
  }

  reqTickByTickData(tickerId, contract, tickType, numberOfTicks, ignoreSize) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    assert(typeof tickType === 'string', '"tickType" must be a string - ' + tickType)
    assert(Number.isInteger(numberOfTicks), '"numberOfTicks" must be a number - ' + numberOfTicks)
    assert(typeof ignoreSize === 'boolean', '"ignoreSize" must be an boolean - ' + ignoreSize)
    this._sendMessage(
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

    return this
  }

  cancelTickByTickData(tickerId) {
    assert(Number.isInteger(tickerId), '"tickerId" must be an integer - ' + tickerId)
    this._sendMessage(
      {
        id: tickerId,
        error: BROKER_ERRORS.FAIL_SEND_CANTICKBYTICK
      },
      'cancelTickByTickData',
      tickerId
    )

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
}
export default IBClient
