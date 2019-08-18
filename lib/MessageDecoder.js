import { isEmpty } from 'lodash'
import { TICK_TYPE } from './constants'
import BufferParser from './BufferParser'

class MessageDecoder {
  constructor(options = { eventHandler: null }) {
    this._eventHandler = options.eventHandler
    this._bufferParser = new BufferParser()
  }

  receiveMessage(message) {
    this._bufferParser.write(message)
  }

  decodeMessage() {
    this._bufferParser.process((err, methodName) => {
      if (methodName && typeof this['_' + methodName] === 'function') this['_' + methodName]()
      else throw new Error('Unknown broker API response: ' + methodName)
      if (err) throw err
    })
  }

  _emit() {
    this._eventHandler.emit(...arguments)
  }

  _ACCT_DOWNLOAD_END() {
    let version = this._bufferParser.readAndShiftInt()
    let accountName = this._bufferParser.readAndShift()
    this._emit('accountDownloadEnd', accountName)
  }
  _ACCOUNT_SUMMARY() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    let account = this._bufferParser.readAndShift()
    let tag = this._bufferParser.readAndShift()
    let value = this._bufferParser.readAndShift()
    let currency = this._bufferParser.readAndShift()
    this._emit('accountSummary', reqId, account, tag, value, currency)
  }
  _ACCOUNT_UPDATE_MULTI_END() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShift()
    this._emit('accountUpdateMultiEnd', reqId)
  }
  _ACCOUNT_UPDATE_MULTI() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    let account = this._bufferParser.readAndShift()
    let modelCode = this._bufferParser.readAndShift()
    let key = this._bufferParser.readAndShift()
    let value = this._bufferParser.readAndShift()
    let currency = this._bufferParser.readAndShift()
    this._emit('accountUpdateMulti', reqId, account, modelCode, key, value, currency)
  }
  _ACCOUNT_SUMMARY_END() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    this._emit('accountSummaryEnd', reqId)
  }
  _ACCT_UPDATE_TIME() {
    let version = this._bufferParser.readAndShiftInt()
    let timeStamp = this._bufferParser.readAndShift()
    this._emit('updateAccountTime', timeStamp)
  }
  _ACCT_VALUE() {
    let version = this._bufferParser.readAndShiftInt()
    let key = this._bufferParser.readAndShift()
    let value = this._bufferParser.readAndShift()
    let currency = this._bufferParser.readAndShift()
    let accountName = null
    if (version >= 2) {
      accountName = this._bufferParser.readAndShift()
    }
    this._emit('updateAccountValue', key, value, currency, accountName)
  }
  _COMMISSION_REPORT() {
    let version = this._bufferParser.readAndShiftInt()
    let commissionReport = {}
    commissionReport.execId = this._bufferParser.readAndShift()
    commissionReport.commission = this._bufferParser.readAndShiftFloat()
    commissionReport.currency = this._bufferParser.readAndShift()
    commissionReport.realizedPNL = this._bufferParser.readAndShiftFloat()
    commissionReport.yield = this._bufferParser.readAndShiftFloat()
    commissionReport.yieldRedemptionDate = this._bufferParser.readAndShiftInt()
    this._emit('commissionReport', commissionReport)
  }
  _BOND_CONTRACT_DATA() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = -1
    if (version >= 3) {
      reqId = this._bufferParser.readAndShiftInt()
    }
    let contract = {
      summary: {}
    }
    contract.summary.symbol = this._bufferParser.readAndShift()
    contract.summary.secType = this._bufferParser.readAndShift()
    contract.cusip = this._bufferParser.readAndShift()
    contract.coupon = this._bufferParser.readAndShiftFloat()
    contract.maturity = this._bufferParser.readAndShift()
    contract.issueDate = this._bufferParser.readAndShift()
    contract.ratings = this._bufferParser.readAndShift()
    contract.bondType = this._bufferParser.readAndShift()
    contract.couponType = this._bufferParser.readAndShift()
    contract.convertible = this._bufferParser.readAndShiftBool()
    contract.callable = this._bufferParser.readAndShiftBool()
    contract.putable = this._bufferParser.readAndShiftBool()
    contract.descAppend = this._bufferParser.readAndShift()
    contract.summary.exchange = this._bufferParser.readAndShift()
    contract.summary.currency = this._bufferParser.readAndShift()
    contract.marketName = this._bufferParser.readAndShift()
    contract.summary.tradingClass = this._bufferParser.readAndShift()
    contract.summary.conId = this._bufferParser.readAndShiftInt()
    contract.minTick = this._bufferParser.readAndShiftFloat()
    contract.orderTypes = this._bufferParser.readAndShift()
    contract.validExchanges = this._bufferParser.readAndShift()
    if (version >= 2) {
      contract.nextOptionDate = this._bufferParser.readAndShift()
      contract.nextOptionType = this._bufferParser.readAndShift()
      contract.nextOptionPartial = this._bufferParser.readAndShiftBool()
      contract.notes = this._bufferParser.readAndShift()
    }
    if (version >= 4) {
      contract.longName = this._bufferParser.readAndShift()
    }
    if (version >= 6) {
      contract.evRule = this._bufferParser.readAndShift()
      contract.evMultiplier = this._bufferParser.readAndShiftFloat()
    }
    let secIdListCount
    let tagValue
    if (version >= 5) {
      secIdListCount = this._bufferParser.readAndShiftInt()
      if (secIdListCount > 0) {
        contract.secIdList = []
        while (secIdListCount--) {
          tagValue = {}
          tagValue.tag = this._bufferParser.readAndShift()
          tagValue.value = this._bufferParser.readAndShift()
          contract.secIdList.push(tagValue)
        }
      }
    }
    this._emit('bondContractDetails', reqId, contract)
  }
  _CONTRACT_DATA() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = -1
    if (version >= 3) {
      reqId = this._bufferParser.readAndShiftInt()
    }
    let contract = {
      summary: {}
    }
    contract.summary.symbol = this._bufferParser.readAndShift()
    contract.summary.secType = this._bufferParser.readAndShift()
    contract.summary.expiry = this._bufferParser.readAndShift()
    contract.summary.strike = this._bufferParser.readAndShiftFloat()
    contract.summary.right = this._bufferParser.readAndShift()
    contract.summary.exchange = this._bufferParser.readAndShift()
    contract.summary.currency = this._bufferParser.readAndShift()
    contract.summary.localSymbol = this._bufferParser.readAndShift()
    contract.marketName = this._bufferParser.readAndShift()
    contract.summary.tradingClass = this._bufferParser.readAndShift()
    contract.summary.conId = this._bufferParser.readAndShiftInt()
    contract.minTick = this._bufferParser.readAndShiftFloat()
    contract.summary.multiplier = this._bufferParser.readAndShift()
    contract.orderTypes = this._bufferParser.readAndShift()
    contract.validExchanges = this._bufferParser.readAndShift()
    if (version >= 2) {
      contract.priceMagnifier = this._bufferParser.readAndShiftInt()
    }
    if (version >= 4) {
      contract.underConId = this._bufferParser.readAndShiftInt()
    }
    if (version >= 5) {
      contract.longName = this._bufferParser.readAndShift()
      contract.summary.primaryExch = this._bufferParser.readAndShift()
    }
    if (version >= 6) {
      contract.contractMonth = this._bufferParser.readAndShift()
      contract.industry = this._bufferParser.readAndShift()
      contract.category = this._bufferParser.readAndShift()
      contract.subcategory = this._bufferParser.readAndShift()
      contract.timeZoneId = this._bufferParser.readAndShift()
      contract.tradingHours = this._bufferParser.readAndShift()
      contract.liquidHours = this._bufferParser.readAndShift()
    }
    if (version >= 8) {
      contract.evRule = this._bufferParser.readAndShift()
      contract.evMultiplier = this._bufferParser.readAndShiftFloat()
    }
    let secIdListCount
    let tagValue

    if (version >= 7) {
      secIdListCount = this._bufferParser.readAndShiftInt()
      if (secIdListCount > 0) {
        contract.secIdList = []
        for (let i = 0; i < secIdListCount; ++i) {
          tagValue = {}
          tagValue.tag = this._bufferParser.readAndShift()
          tagValue.value = this._bufferParser.readAndShift()
          contract.secIdList.push(tagValue)
        }
      }
    }
    this._emit('contractDetails', reqId, contract)
  }
  _CONTRACT_DATA_END() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    this._emit('contractDetailsEnd', reqId)
  }
  _CURRENT_TIME() {
    let version = this._bufferParser.readAndShiftInt()
    let time = this._bufferParser.readAndShiftInt()
    this._emit('currentTime', time)
  }
  _DELTA_NEUTRAL_VALIDATION() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    let underComp = {}
    underComp.conId = this._bufferParser.readAndShiftInt()
    underComp.delta = this._bufferParser.readAndShiftFloat()
    underComp.price = this._bufferParser.readAndShiftFloat()
    this._emit('deltaNeutralValidation', reqId, underComp)
  }
  _ERR_MSG() {
    let errorCode
    let errorMsg
    let id
    let version = this._bufferParser.readAndShiftInt()
    if (version < 2) {
      errorMsg = this._bufferParser.readAndShift()
      this._controller.emitError(errorMsg)
    } else {
      id = this._bufferParser.readAndShiftInt()
      errorCode = this._bufferParser.readAndShiftInt()
      errorMsg = this._bufferParser.readAndShift()
      this._controller.emitError(errorMsg, {
        id: id,
        code: errorCode
      })
    }
  }
  _EXECUTION_DATA() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = -1
    if (version >= 7) {
      reqId = this._bufferParser.readAndShiftInt()
    }
    let orderId = this._bufferParser.readAndShiftInt()
    // read contract fields
    let contract = {}
    if (version >= 5) {
      contract.conId = this._bufferParser.readAndShiftInt()
    }
    contract.symbol = this._bufferParser.readAndShift()
    contract.secType = this._bufferParser.readAndShift()
    contract.expiry = this._bufferParser.readAndShift()
    contract.strike = this._bufferParser.readAndShiftFloat()
    contract.right = this._bufferParser.readAndShift()
    if (version >= 9) {
      contract.multiplier = this._bufferParser.readAndShift()
    }
    contract.exchange = this._bufferParser.readAndShift()
    contract.currency = this._bufferParser.readAndShift()
    contract.localSymbol = this._bufferParser.readAndShift()
    if (version >= 10) {
      contract.tradingClass = this._bufferParser.readAndShift()
    }
    let exec = {}
    exec.orderId = orderId
    exec.execId = this._bufferParser.readAndShift()
    exec.time = this._bufferParser.readAndShift()
    exec.acctNumber = this._bufferParser.readAndShift()
    exec.exchange = this._bufferParser.readAndShift()
    exec.side = this._bufferParser.readAndShift()
    exec.shares = this._bufferParser.readAndShift()
    exec.price = this._bufferParser.readAndShiftFloat()
    if (version >= 2) {
      exec.permId = this._bufferParser.readAndShiftInt()
    }
    if (version >= 3) {
      exec.clientId = this._bufferParser.readAndShiftInt()
    }
    if (version >= 4) {
      exec.liquidation = this._bufferParser.readAndShiftInt()
    }
    if (version >= 6) {
      exec.cumQty = this._bufferParser.readAndShiftInt()
      exec.avgPrice = this._bufferParser.readAndShiftFloat()
    }
    if (version >= 8) {
      exec.orderRef = this._bufferParser.readAndShift()
    }
    if (version >= 9) {
      exec.evRule = this._bufferParser.readAndShift()
      exec.evMultiplier = this._bufferParser.readAndShiftFloat()
    }
    this._emit('execDetails', reqId, contract, exec)
  }
  _EXECUTION_DATA_END() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    this._emit('execDetailsEnd', reqId)
  }
  _FUNDAMENTAL_DATA() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    let data = this._bufferParser.readAndShift()
    this._emit('fundamentalData', reqId, data)
  }
  _HISTORICAL_DATA() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    let completedIndicator = 'finished'
    let startDateStr
    let endDateStr
    if (version >= 2) {
      startDateStr = this._bufferParser.readAndShift()
      endDateStr = this._bufferParser.readAndShift()
      completedIndicator += '-' + startDateStr + '-' + endDateStr
    }
    let itemCount = this._bufferParser.readAndShiftInt()
    let time
    let open
    let high
    let low
    let close
    let volume
    let WAP
    let hasGaps
    let barCount
    while (itemCount--) {
      time = this._bufferParser.readAndShift()
      open = this._bufferParser.readAndShiftFloat()
      high = this._bufferParser.readAndShiftFloat()
      low = this._bufferParser.readAndShiftFloat()
      close = this._bufferParser.readAndShiftFloat()
      volume = this._bufferParser.readAndShiftInt()
      WAP = this._bufferParser.readAndShiftFloat()
      hasGaps = this._bufferParser.readAndShiftBool()
      barCount = -1
      if (version >= 3) {
        barCount = this._bufferParser.readAndShiftInt()
      }
      this._emit('historicalData', reqId, {
        time,
        open,
        high,
        low,
        close,
        volume,
        count: barCount,
        WAP,
        hasGaps
      })
    }
    // send end of dataset marker
    this._emit('historicalDataEnd', reqId, startDateStr, endDateStr)
  }
  _HISTORICAL_TICKS_LAST() {
    let reqId = this._bufferParser.readAndShiftInt()
    let tickCount = this._bufferParser.readAndShiftInt()
    let date
    let mask
    let price
    let size
    let exchange
    let specialConditions
    while (tickCount--) {
      date = this._bufferParser.readAndShift()
      mask = this._bufferParser.readAndShiftInt()
      price = this._bufferParser.readAndShiftFloat()
      size = this._bufferParser.readAndShiftInt()
      exchange = this._bufferParser.readAndShift()
      specialConditions = this._bufferParser.readAndShift()
      this._emit(
        'historicalTickTradeData',
        reqId,
        date,
        mask,
        price,
        size,
        exchange,
        specialConditions
      )
    }
    let done = this._bufferParser.readAndShiftBool()
    if (done) {
      this._emit('historicalTickDataEnd', reqId)
    }
  }
  _HISTORICAL_TICKS_BID_ASK() {
    let reqId = this._bufferParser.readAndShiftInt()
    let tickCount = this._bufferParser.readAndShiftInt()
    let date
    let mask
    let priceBid
    let sizeBid
    let priceAsk
    let sizeAsk
    while (tickCount--) {
      date = this._bufferParser.readAndShift()
      mask = this._bufferParser.readAndShiftInt()
      priceBid = this._bufferParser.readAndShiftFloat()
      priceAsk = this._bufferParser.readAndShiftFloat()
      sizeBid = this._bufferParser.readAndShiftInt()
      sizeAsk = this._bufferParser.readAndShiftInt()
      this._emit(
        'historicalTickBidAskData',
        reqId,
        date,
        mask,
        priceBid,
        priceAsk,
        sizeBid,
        sizeAsk
      )
    }
    let done = this._bufferParser.readAndShiftBool()
    if (done) {
      this._emit('historicalTickDataEnd', reqId)
    }
  }
  _HISTORICAL_TICKS() {
    let reqId = this._bufferParser.readAndShiftInt()
    let tickCount = this._bufferParser.readAndShiftInt()
    let date
    let price
    let size
    while (tickCount--) {
      date = this._bufferParser.readAndShift()
      this._bufferParser.readAndShiftInt() // for consistency
      price = this._bufferParser.readAndShiftFloat()
      size = this._bufferParser.readAndShiftInt()
      this._emit('historicalTickMidPointData', reqId, date, price, size)
    }
    let done = this._bufferParser.readAndShiftBool()
    if (done) {
      this._emit('historicalTickDataEnd', reqId)
    }
  }
  _TICK_BY_TICK() {
    let reqId = this._bufferParser.readAndShiftInt()
    let tickType = this._bufferParser.readAndShiftInt()
    let time = this._bufferParser.readAndShift()
    let mask
    switch (tickType) {
      case 0: // None
        break
      case 1: // Last
      case 2: // Alllast
        let price = this._bufferParser.readAndShiftFloat()
        let size = this._bufferParser.readAndShiftInt()
        mask = this._bufferParser.readAndShiftInt()
        let pastLimit = (mask & (1 << 0)) !== 0
        let unreported = (mask & (1 << 1)) !== 0
        let exchange = this._bufferParser.readAndShift()
        let specialConditions = this._bufferParser.readAndShift()
        this._emit(
          'tickByTickAllLast',
          reqId,
          tickType,
          time,
          price,
          size,
          { pastLimit, unreported },
          exchange,
          specialConditions
        )
        break
      case 3: // BidAsk
        let bidPrice = this._bufferParser.readAndShiftFloat()
        let askPrice = this._bufferParser.readAndShiftFloat()
        let bidSize = this._bufferParser.readAndShiftInt()
        let askSize = this._bufferParser.readAndShiftInt()
        mask = this._bufferParser.readAndShiftInt()
        let bidPastLow = (mask & (1 << 0)) !== 0
        let askPastHigh = (mask & (1 << 1)) !== 0
        this._emit('tickByTickBidAsk', reqId, time, bidPrice, askPrice, bidSize, askSize, {
          bidPastLow,
          askPastHigh
        })
        break
      case 4: // MidPoint
        let midPoint = this._bufferParser.readAndShiftFloat()
        this._emit('tickByTickMidPoint', reqId, time, midPoint)
        break
    }
  }
  _HEAD_TIMESTAMP() {
    let reqId = this._bufferParser.readAndShiftInt()
    let headTimestamp = this._bufferParser.readAndShift()
    this._emit('headTimestamp', reqId, headTimestamp)
  }
  _MANAGED_ACCTS() {
    let version = this._bufferParser.readAndShiftInt()
    let accountsList = this._bufferParser.readAndShift()
    this._emit('managedAccounts', accountsList)
  }
  _MARKET_DATA_TYPE() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    let marketDataType = this._bufferParser.readAndShiftInt()
    this._emit('marketDataType', reqId, marketDataType)
  }
  _MARKET_DEPTH() {
    let version = this._bufferParser.readAndShiftInt()
    let id = this._bufferParser.readAndShiftInt()
    let position = this._bufferParser.readAndShiftInt()
    let operation = this._bufferParser.readAndShiftInt()
    let side = this._bufferParser.readAndShiftInt()
    let price = this._bufferParser.readAndShiftFloat()
    let size = this._bufferParser.readAndShiftInt()
    this._emit('updateMktDepth', id, position, operation, side, price, size)
  }
  _MARKET_DEPTH_L2() {
    let version = this._bufferParser.readAndShiftInt()
    let id = this._bufferParser.readAndShiftInt()
    let position = this._bufferParser.readAndShiftInt()
    let marketMaker = this._bufferParser.readAndShift()
    let operation = this._bufferParser.readAndShiftInt()
    let side = this._bufferParser.readAndShiftInt()
    let price = this._bufferParser.readAndShiftFloat()
    let size = this._bufferParser.readAndShiftInt()
    this._emit('updateMktDepthL2', id, position, marketMaker, operation, side, price, size)
  }
  _NEWS_BULLETINS() {
    let version = this._bufferParser.readAndShiftInt()
    let newsMsgId = this._bufferParser.readAndShiftInt()
    let newsMsgType = this._bufferParser.readAndShiftInt()
    let newsMessage = this._bufferParser.readAndShift()
    let originatingExch = this._bufferParser.readAndShift()
    this._emit('updateNewsBulletin', newsMsgId, newsMsgType, newsMessage, originatingExch)
  }
  _NEXT_VALID_ID() {
    let version = this._bufferParser.readAndShiftInt()
    let orderId = this._bufferParser.readAndShiftInt()
    this._emit('nextValidId', orderId)
  }
  _OPEN_ORDER() {
    // read version
    let version = this._bufferParser.readAndShiftInt()
    // read order id
    let order = {}
    order.orderId = this._bufferParser.readAndShiftInt()
    // read contract fields
    let contract = {}
    if (version >= 17) {
      contract.conId = this._bufferParser.readAndShiftInt()
    }
    contract.symbol = this._bufferParser.readAndShift()
    contract.secType = this._bufferParser.readAndShift()
    contract.expiry = this._bufferParser.readAndShift()
    contract.strike = this._bufferParser.readAndShiftFloat()
    contract.right = this._bufferParser.readAndShift()
    if (version >= 32) {
      contract.multiplier = this._bufferParser.readAndShift()
    }
    contract.exchange = this._bufferParser.readAndShift()
    contract.currency = this._bufferParser.readAndShift()
    if (version >= 2) {
      contract.localSymbol = this._bufferParser.readAndShift()
    }
    if (version >= 32) {
      contract.tradingClass = this._bufferParser.readAndShift()
    }
    // read order fields
    order.action = this._bufferParser.readAndShift()
    order.totalQuantity = this._bufferParser.readAndShiftInt()
    order.orderType = this._bufferParser.readAndShift()
    if (version < 29) {
      order.lmtPrice = this._bufferParser.readAndShiftFloat()
    } else {
      order.lmtPrice = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
    }
    if (version < 30) {
      order.auxPrice = this._bufferParser.readAndShiftFloat()
    } else {
      order.auxPrice = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
    }
    order.tif = this._bufferParser.readAndShift()
    order.ocaGroup = this._bufferParser.readAndShift()
    order.account = this._bufferParser.readAndShift()
    order.openClose = this._bufferParser.readAndShift()
    order.origin = this._bufferParser.readAndShiftInt()
    order.orderRef = this._bufferParser.readAndShift()
    if (version >= 3) {
      order.clientId = this._bufferParser.readAndShiftInt()
    }
    if (version >= 4) {
      order.permId = this._bufferParser.readAndShiftInt()
      if (version < 18) {
        // will never happen
        /* order.ignoreRth = */
        this._bufferParser.readAndShiftBool()
      } else {
        order.outsideRth = this._bufferParser.readAndShiftBool()
      }
      order.hidden = this._bufferParser.readAndShiftBool()
      order.discretionaryAmt = this._bufferParser.readAndShiftFloat()
    }
    if (version >= 5) {
      order.goodAfterTime = this._bufferParser.readAndShift()
    }
    if (version >= 6) {
      // skip deprecated sharesAllocation field
      this._bufferParser.readAndShift()
    }
    if (version >= 7) {
      order.faGroup = this._bufferParser.readAndShift()
      order.faMethod = this._bufferParser.readAndShift()
      order.faPercentage = this._bufferParser.readAndShift()
      order.faProfile = this._bufferParser.readAndShift()
    }
    if (version >= 8) {
      order.goodTillDate = this._bufferParser.readAndShift()
    }
    if (version >= 9) {
      order.rule80A = this._bufferParser.readAndShift()
      order.percentOffset = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.settlingFirm = this._bufferParser.readAndShift()
      order.shortSaleSlot = this._bufferParser.readAndShiftInt()
      order.designatedLocation = this._bufferParser.readAndShift()
      if (this._controller._serverVersion === 51) {
        this._bufferParser.readAndShiftInt() // exemptCode
      } else if (version >= 23) {
        order.exemptCode = this._bufferParser.readAndShiftInt()
      }
      order.auctionStrategy = this._bufferParser.readAndShiftInt()
      order.startingPrice = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.stockRefPrice = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.delta = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.stockRangeLower = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.stockRangeUpper = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.displaySize = this._bufferParser.readAndShiftInt()
      if (version < 18) {
        // will never happen
        /* order.rthOnly = */
        this._bufferParser.readAndShiftBool()
      }
      order.blockOrder = this._bufferParser.readAndShiftBool()
      order.sweepToFill = this._bufferParser.readAndShiftBool()
      order.allOrNone = this._bufferParser.readAndShiftBool()
      order.minQty = this._bufferParser.readAndShiftInt() || Number.MAX_VALUE
      order.ocaType = this._bufferParser.readAndShiftInt()
      order.eTradeOnly = this._bufferParser.readAndShiftBool()
      order.firmQuoteOnly = this._bufferParser.readAndShiftBool()
      order.nbboPriceCap = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
    }
    if (version >= 10) {
      order.parentId = this._bufferParser.readAndShiftInt()
      order.triggerMethod = this._bufferParser.readAndShiftInt()
    }
    let receivedInt
    if (version >= 11) {
      order.volatility = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.volatilityType = this._bufferParser.readAndShiftInt()
      if (version === 11) {
        receivedInt = this._bufferParser.readAndShiftInt()
        order.deltaNeutralOrderType = receivedInt === 0 ? 'NONE' : 'MKT'
      } else {
        // version 12 and up
        order.deltaNeutralOrderType = this._bufferParser.readAndShift()
        order.deltaNeutralAuxPrice = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
        if (version >= 27 && !isEmpty(order.deltaNeutralOrderType)) {
          order.deltaNeutralConId = this._bufferParser.readAndShiftInt()
          order.deltaNeutralSettlingFirm = this._bufferParser.readAndShift()
          order.deltaNeutralClearingAccount = this._bufferParser.readAndShift()
          order.deltaNeutralClearingIntent = this._bufferParser.readAndShift()
        }
        if (version >= 31 && !isEmpty(order.deltaNeutralOrderType)) {
          order.deltaNeutralOpenClose = this._bufferParser.readAndShift()
          order.deltaNeutralShortSale = this._bufferParser.readAndShiftBool()
          order.deltaNeutralShortSaleSlot = this._bufferParser.readAndShiftInt()
          order.deltaNeutralDesignatedLocation = this._bufferParser.readAndShift()
        }
      }
      order.continuousUpdate = this._bufferParser.readAndShiftInt()
      if (this._controller._serverVersion === 26) {
        order.stockRangeLower = this._bufferParser.readAndShiftFloat()
        order.stockRangeUpper = this._bufferParser.readAndShiftFloat()
      }
      order.referencePriceType = this._bufferParser.readAndShiftInt()
    }
    if (version >= 13) {
      order.trailStopPrice = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
    }
    if (version >= 30) {
      order.trailingPercent = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
    }
    if (version >= 14) {
      order.basisPoints = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.basisPointsType = this._bufferParser.readAndShiftInt() || Number.MAX_VALUE
      contract.comboLegsDescrip = this._bufferParser.readAndShift()
    }
    let comboLeg
    let comboLegsCount
    let orderComboLeg
    let orderComboLegsCount
    if (version >= 29) {
      comboLegsCount = this._bufferParser.readAndShiftInt()
      if (comboLegsCount > 0) {
        contract.comboLegs = []
        for (let i = 0; i < comboLegsCount; ++i) {
          comboLeg = {}
          comboLeg.conId = this._bufferParser.readAndShiftInt()
          comboLeg.ratio = this._bufferParser.readAndShiftInt()
          comboLeg.action = this._bufferParser.readAndShift()
          comboLeg.exchange = this._bufferParser.readAndShift()
          comboLeg.openClose = this._bufferParser.readAndShiftInt()
          comboLeg.shortSaleSlot = this._bufferParser.readAndShiftInt()
          comboLeg.designatedLocation = this._bufferParser.readAndShift()
          comboLeg.exemptCode = this._bufferParser.readAndShiftInt()
          contract.comboLegs.push(comboLeg)
        }
      }
      orderComboLegsCount = this._bufferParser.readAndShiftInt()
      if (orderComboLegsCount > 0) {
        order.orderComboLegs = []
        for (let i = 0; i < orderComboLegsCount; ++i) {
          orderComboLeg = {}
          order.price = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
          order.orderComboLegs.push(orderComboLeg)
        }
      }
    }
    let smartComboRoutingParamsCount
    let tagValue
    if (version >= 26) {
      smartComboRoutingParamsCount = this._bufferParser.readAndShiftInt()
      if (smartComboRoutingParamsCount > 0) {
        order.smartComboRoutingParams = []
        for (let i = 0; i < smartComboRoutingParamsCount; ++i) {
          tagValue = {}
          tagValue.tag = this._bufferParser.readAndShift()
          tagValue.value = this._bufferParser.readAndShift()
          order.smartComboRoutingParams.push(tagValue)
        }
      }
    }
    if (version >= 15) {
      if (version >= 20) {
        order.scaleInitLevelSize = this._bufferParser.readAndShiftInt() || Number.MAX_VALUE
        order.scaleSubsLevelSize = this._bufferParser.readAndShiftInt() || Number.MAX_VALUE
      } else {
        let notSuppScaleNumComponents = this._bufferParser.readAndShiftInt() || Number.MAX_VALUE
        order.scaleInitLevelSize = this._bufferParser.readAndShiftInt() || Number.MAX_VALUE
      }
      order.scalePriceIncrement = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
    }
    if (
      version >= 28 &&
      order.scalePriceIncrement > 0.0 &&
      order.scalePriceIncrement !== Number.MAX_VALUE
    ) {
      order.scalePriceAdjustValue = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.scalePriceAdjustInterval = this._bufferParser.readAndShiftInt() || Number.MAX_VALUE
      order.scaleProfitOffset = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.scaleAutoReset = this._bufferParser.readAndShiftBool()
      order.scaleInitPosition = this._bufferParser.readAndShiftInt() || Number.MAX_VALUE
      order.scaleInitFillQty = this._bufferParser.readAndShiftInt() || Number.MAX_VALUE
      order.scaleRandomPercent = this._bufferParser.readAndShiftBool()
    }
    if (version >= 24) {
      order.hedgeType = this._bufferParser.readAndShift()
      if (!isEmpty(order.hedgeType)) {
        order.hedgeParam = this._bufferParser.readAndShift()
      }
    }
    if (version >= 25) {
      order.optOutSmartRouting = this._bufferParser.readAndShiftBool()
    }
    if (version >= 19) {
      order.clearingAccount = this._bufferParser.readAndShift()
      order.clearingIntent = this._bufferParser.readAndShift()
    }
    if (version >= 22) {
      order.notHeld = this._bufferParser.readAndShiftBool()
    }
    let underComp
    if (version >= 20) {
      if (this._bufferParser.readAndShiftBool()) {
        underComp = {}
        underComp.conId = this._bufferParser.readAndShiftInt()
        underComp.delta = this._bufferParser.readAndShiftFloat()
        underComp.price = this._bufferParser.readAndShiftFloat()
        contract.underComp = underComp
      }
    }
    let algoParamsCount
    if (version >= 21) {
      order.algoStrategy = this._bufferParser.readAndShift()
      if (!isEmpty(order.algoStrategy)) {
        algoParamsCount = this._bufferParser.readAndShiftInt()
        if (algoParamsCount > 0) {
          order.algoParams = []
          for (let i = 0; i < algoParamsCount; ++i) {
            tagValue = {}
            tagValue.tag = this._bufferParser.readAndShift()
            tagValue.value = this._bufferParser.readAndShift()
            order.algoParams.push(tagValue)
          }
        }
      }
    }
    let orderState = {}
    if (version >= 16) {
      order.whatIf = this._bufferParser.readAndShiftBool()
      orderState.status = this._bufferParser.readAndShift()
      orderState.initMargin = this._bufferParser.readAndShift()
      orderState.maintMargin = this._bufferParser.readAndShift()
      orderState.equityWithLoan = this._bufferParser.readAndShift()
      orderState.commission = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      orderState.minCommission = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      orderState.maxCommission = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      orderState.commissionCurrency = this._bufferParser.readAndShift()
      orderState.warningText = this._bufferParser.readAndShift()
    }
    this._emit('openOrder', order.orderId, contract, order, orderState)
  }
  _OPEN_ORDER_END() {
    let version = this._bufferParser.readAndShiftInt()
    this._emit('openOrderEnd')
  }
  _ORDER_STATUS() {
    let version = this._bufferParser.readAndShiftInt()
    let id = this._bufferParser.readAndShiftInt()
    let status = this._bufferParser.readAndShift()
    let filled = this._bufferParser.readAndShiftInt()
    let remaining = this._bufferParser.readAndShiftInt()
    let avgFillPrice = this._bufferParser.readAndShiftFloat()
    let permId = 0
    if (version >= 2) {
      permId = this._bufferParser.readAndShiftInt()
    }
    let parentId = 0
    if (version >= 3) {
      parentId = this._bufferParser.readAndShiftInt()
    }
    let lastFillPrice = 0
    if (version >= 4) {
      lastFillPrice = this._bufferParser.readAndShiftFloat()
    }
    let clientId = 0
    if (version >= 5) {
      clientId = this._bufferParser.readAndShiftInt()
    }
    let whyHeld = null
    if (version >= 6) {
      whyHeld = this._bufferParser.readAndShift()
    }
    this._emit(
      'orderStatus',
      id,
      status,
      filled,
      remaining,
      avgFillPrice,
      permId,
      parentId,
      lastFillPrice,
      clientId,
      whyHeld
    )
  }
  _PORTFOLIO_VALUE() {
    let version = this._bufferParser.readAndShiftInt()
    let contract = {}
    if (version >= 6) {
      contract.conId = this._bufferParser.readAndShiftInt()
    }
    contract.symbol = this._bufferParser.readAndShift()
    contract.secType = this._bufferParser.readAndShift()
    contract.expiry = this._bufferParser.readAndShift()
    contract.strike = this._bufferParser.readAndShiftFloat()
    contract.right = this._bufferParser.readAndShift()
    if (version >= 7) {
      contract.multiplier = this._bufferParser.readAndShift()
      contract.primaryExch = this._bufferParser.readAndShift()
    }
    contract.currency = this._bufferParser.readAndShift()
    if (version >= 2) {
      contract.localSymbol = this._bufferParser.readAndShift()
    }
    if (version >= 8) {
      contract.tradingClass = this._bufferParser.readAndShift()
    }
    let position = this._bufferParser.readAndShiftInt()
    let marketPrice = this._bufferParser.readAndShiftFloat()
    let marketValue = this._bufferParser.readAndShiftFloat()
    let averageCost = 0.0
    let unrealizedPNL = 0.0
    let realizedPNL = 0.0
    if (version >= 3) {
      averageCost = this._bufferParser.readAndShiftFloat()
      unrealizedPNL = this._bufferParser.readAndShiftFloat()
      realizedPNL = this._bufferParser.readAndShiftFloat()
    }
    let accountName = null
    if (version >= 4) {
      accountName = this._bufferParser.readAndShift()
    }
    if (version === 6 && this._controller._serverVersion === 39) {
      contract.primaryExch = this._bufferParser.readAndShift()
    }
    this._emit(
      'updatePortfolio',
      contract,
      position,
      marketPrice,
      marketValue,
      averageCost,
      unrealizedPNL,
      realizedPNL,
      accountName
    )
  }
  _POSITION() {
    let version = this._bufferParser.readAndShiftInt()
    let account = this._bufferParser.readAndShift()
    let contract = {}
    contract.conId = this._bufferParser.readAndShiftInt()
    contract.symbol = this._bufferParser.readAndShift()
    contract.secType = this._bufferParser.readAndShift()
    contract.expiry = this._bufferParser.readAndShift()
    contract.strike = this._bufferParser.readAndShiftFloat()
    contract.right = this._bufferParser.readAndShift()
    contract.multiplier = this._bufferParser.readAndShift()
    contract.exchange = this._bufferParser.readAndShift()
    contract.currency = this._bufferParser.readAndShift()
    contract.localSymbol = this._bufferParser.readAndShift()
    if (version >= 2) {
      contract.tradingClass = this._bufferParser.readAndShift()
    }
    let pos = this._bufferParser.readAndShiftInt()
    let avgCost = 0
    if (version >= 3) {
      avgCost = this._bufferParser.readAndShiftFloat()
    }
    this._emit('position', account, contract, pos, avgCost)
  }
  _POSITION_END() {
    let version = this._bufferParser.readAndShiftInt()
    this._emit('positionEnd')
  }
  _POSITION_MULTI() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    let account = this._bufferParser.readAndShift()
    let modelCode = null
    let contract = {}
    contract.conId = this._bufferParser.readAndShiftInt()
    contract.symbol = this._bufferParser.readAndShift()
    contract.secType = this._bufferParser.readAndShift()
    contract.expiry = this._bufferParser.readAndShift()
    contract.strike = this._bufferParser.readAndShiftFloat()
    contract.right = this._bufferParser.readAndShift()
    contract.multiplier = this._bufferParser.readAndShift()
    contract.exchange = this._bufferParser.readAndShift()
    contract.currency = this._bufferParser.readAndShift()
    contract.localSymbol = this._bufferParser.readAndShift()
    contract.tradingClass = this._bufferParser.readAndShift()
    let pos = this._bufferParser.readAndShiftInt()
    let avgCost = 0
    avgCost = this._bufferParser.readAndShiftFloat()
    this._emit('positionMulti', reqId, account, modelCode, contract, pos, avgCost)
  }
  _POSITION_MULTI_END() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    this._emit('positionMultiEnd', reqId)
  }
  _REAL_TIME_BARS() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    let time = this._bufferParser.readAndShiftInt()
    let open = this._bufferParser.readAndShiftFloat()
    let high = this._bufferParser.readAndShiftFloat()
    let low = this._bufferParser.readAndShiftFloat()
    let close = this._bufferParser.readAndShiftFloat()
    let volume = this._bufferParser.readAndShiftInt()
    let wap = this._bufferParser.readAndShiftFloat()
    let count = this._bufferParser.readAndShiftInt()
    this._emit('realtimeBar', reqId, time, open, high, low, close, volume, wap, count)
  }
  _RECEIVE_FA() {
    let version = this._bufferParser.readAndShiftInt()
    let faDataType = this._bufferParser.readAndShiftInt()
    let xml = this._bufferParser.readAndShift()
    this._emit('receiveFA', faDataType, xml)
  }
  _SCANNER_DATA() {
    let version = this._bufferParser.readAndShiftInt()
    let tickerId = this._bufferParser.readAndShiftInt()
    let numberOfElements = this._bufferParser.readAndShiftInt()
    let rank
    while (numberOfElements--) {
      let contract = {
        summary: {}
      }
      rank = this._bufferParser.readAndShiftInt()
      if (version >= 3) {
        contract.summary.conId = this._bufferParser.readAndShiftInt()
      }
      contract.summary.symbol = this._bufferParser.readAndShift()
      contract.summary.secType = this._bufferParser.readAndShift()
      contract.summary.expiry = this._bufferParser.readAndShift()
      contract.summary.strike = this._bufferParser.readAndShiftFloat()
      contract.summary.right = this._bufferParser.readAndShift()
      contract.summary.exchange = this._bufferParser.readAndShift()
      contract.summary.currency = this._bufferParser.readAndShift()
      contract.summary.localSymbol = this._bufferParser.readAndShift()
      contract.marketName = this._bufferParser.readAndShift()
      contract.summary.tradingClass = this._bufferParser.readAndShift()
      let distance = this._bufferParser.readAndShift()
      let benchmark = this._bufferParser.readAndShift()
      let projection = this._bufferParser.readAndShift()
      let legsStr = null
      if (version >= 2) {
        legsStr = this._bufferParser.readAndShift()
      }
      this._emit('scannerData', tickerId, rank, contract, distance, benchmark, projection, legsStr)
    }
    this._emit('scannerDataEnd', tickerId)
  }
  _SCANNER_PARAMETERS() {
    let version = this._bufferParser.readAndShiftInt()
    let xml = this._bufferParser.readAndShift()
    this._emit('scannerParameters', xml)
  }
  _SECURITY_DEFINITION_OPTION_PARAMETER() {
    let reqId = this._bufferParser.readAndShiftInt()
    let exchange = this._bufferParser.readAndShift()
    let underlyingConId = this._bufferParser.readAndShiftInt()
    let tradingClass = this._bufferParser.readAndShift()
    let multiplier = this._bufferParser.readAndShift()
    let expCount = this._bufferParser.readAndShiftInt()
    let expirations = []
    for (let i = 0; i < expCount; i++) {
      expirations.push(this._bufferParser.readAndShift())
    }
    let strikeCount = this._bufferParser.readAndShiftInt()
    let strikes = []
    for (let j = 0; j < strikeCount; j++) {
      strikes.push(this._bufferParser.readAndShiftFloat())
    }
    this._emit(
      'securityDefinitionOptionParameter',
      reqId,
      exchange,
      underlyingConId,
      tradingClass,
      multiplier,
      expirations,
      strikes
    )
  }
  _SECURITY_DEFINITION_OPTION_PARAMETER_END() {
    let reqId = this._bufferParser.readAndShiftInt()
    this._emit('securityDefinitionOptionParameterEnd', reqId)
  }
  _TICK_EFP() {
    let version = this._bufferParser.readAndShiftInt()
    let tickerId = this._bufferParser.readAndShiftInt()
    let tickType = this._bufferParser.readAndShiftInt()
    let basisPoints = this._bufferParser.readAndShiftFloat()
    let formattedBasisPoints = this._bufferParser.readAndShift()
    let impliedFuturesPrice = this._bufferParser.readAndShiftFloat()
    let holdDays = this._bufferParser.readAndShiftInt()
    let futureExpiry = this._bufferParser.readAndShift()
    let dividendImpact = this._bufferParser.readAndShiftFloat()
    let dividendsToExpiry = this._bufferParser.readAndShiftFloat()
    this._emit(
      'tickEFP',
      tickerId,
      tickType,
      basisPoints,
      formattedBasisPoints,
      impliedFuturesPrice,
      holdDays,
      futureExpiry,
      dividendImpact,
      dividendsToExpiry
    )
  }
  _TICK_GENERIC() {
    let version = this._bufferParser.readAndShiftInt()
    let tickerId = this._bufferParser.readAndShiftInt()
    let tickType = this._bufferParser.readAndShiftInt()
    let value = this._bufferParser.readAndShiftFloat()
    this._emit('tickGeneric', tickerId, tickType, value)
  }
  _TICK_OPTION_COMPUTATION() {
    let version = this._bufferParser.readAndShiftInt()
    let tickerId = this._bufferParser.readAndShiftInt()
    let tickType = this._bufferParser.readAndShiftInt()
    let impliedVol = this._bufferParser.readAndShiftFloat()
    if (impliedVol < 0) {
      // -1 is the "not yet computed" indicator
      impliedVol = Number.MAX_VALUE
    }
    let delta = this._bufferParser.readAndShiftFloat()
    if (Math.abs(delta) > 1) {
      // -2 is the "not yet computed" indicator
      delta = Number.MAX_VALUE
    }
    let optPrice = Number.MAX_VALUE
    let pvDividend = Number.MAX_VALUE
    let gamma = Number.MAX_VALUE
    let vega = Number.MAX_VALUE
    let theta = Number.MAX_VALUE
    let undPrice = Number.MAX_VALUE
    if (version >= 6 || tickType === TICK_TYPE.MODEL_OPTION) {
      // introduced in version == 5
      optPrice = this._bufferParser.readAndShiftFloat()
      if (optPrice < 0) {
        // -1 is the "not yet computed" indicator
        optPrice = Number.MAX_VALUE
      }
      pvDividend = this._bufferParser.readAndShiftFloat()
      if (pvDividend < 0) {
        // -1 is the "not yet computed" indicator
        pvDividend = Number.MAX_VALUE
      }
    }
    if (version >= 6) {
      gamma = this._bufferParser.readAndShiftFloat()
      if (Math.abs(gamma) > 1) {
        // -2 is the "not yet computed" indicator
        gamma = Number.MAX_VALUE
      }
      vega = this._bufferParser.readAndShiftFloat()
      if (Math.abs(vega) > 1) {
        // -2 is the "not yet computed" indicator
        vega = Number.MAX_VALUE
      }
      theta = this._bufferParser.readAndShiftFloat()
      if (Math.abs(theta) > 1) {
        // -2 is the "not yet computed" indicator
        theta = Number.MAX_VALUE
      }
      undPrice = this._bufferParser.readAndShiftFloat()
      if (undPrice < 0) {
        // -1 is the "not yet computed" indicator
        undPrice = Number.MAX_VALUE
      }
    }
    this._emit(
      'tickOptionComputation',
      tickerId,
      tickType,
      impliedVol,
      delta,
      optPrice,
      pvDividend,
      gamma,
      vega,
      theta,
      undPrice
    )
  }
  _TICK_PRICE() {
    let version = this._bufferParser.readAndShiftInt()
    let tickerId = this._bufferParser.readAndShiftInt()
    let tickType = this._bufferParser.readAndShiftInt()
    let price = this._bufferParser.readAndShiftFloat()
    let size = 0
    if (version >= 2) {
      size = this._bufferParser.readAndShiftInt()
    }
    let canAutoExecute = 0
    if (version >= 3) {
      canAutoExecute = this._bufferParser.readAndShiftBool()
    }
    this._emit('tickPrice', tickerId, tickType, price, canAutoExecute)
    let sizeTickType = -1
    if (version >= 2) {
      sizeTickType = -1 // not a tick
      switch (tickType) {
        case 1: // BID
          sizeTickType = 0 // BID_SIZE
          break
        case 2: // ASK
          sizeTickType = 3 // ASK_SIZE
          break
        case 4: // LAST
          sizeTickType = 5 // LAST_SIZE
          break
        default:
          break
      }
      if (sizeTickType !== -1) {
        this._emit('tickSize', tickerId, sizeTickType, size)
      }
    }
  }
  _TICK_SIZE() {
    let version = this._bufferParser.readAndShiftInt()
    let tickerId = this._bufferParser.readAndShiftInt()
    let tickType = this._bufferParser.readAndShiftInt()
    let size = this._bufferParser.readAndShiftInt()
    this._emit('tickSize', tickerId, tickType, size)
  }
  _TICK_SNAPSHOT_END() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    this._emit('tickSnapshotEnd', reqId)
  }
  _TICK_STRING() {
    let version = this._bufferParser.readAndShiftInt()
    let tickerId = this._bufferParser.readAndShiftInt()
    let tickType = this._bufferParser.readAndShiftInt()
    let value = this._bufferParser.readAndShift()
    this._emit('tickString', tickerId, tickType, value)
  }
  _DISPLAY_GROUP_LIST() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    let list = this._bufferParser.readAndShift()
    this._emit('displayGroupList', reqId, list)
  }
  _DISPLAY_GROUP_UPDATED() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    let contractInfo = this._bufferParser.readAndShift()
    this._emit('displayGroupUpdated', reqId, contractInfo)
  }
}

export default MessageDecoder
