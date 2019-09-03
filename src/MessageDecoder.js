import { isEmpty } from 'lodash'
import { SERVER_VERSION, TICK_TYPE, MIN_SERVER_VER, ORDER_TYPE } from './constants'
import BufferParser from './BufferParser'

class MessageDecoder {
  constructor(options = { eventHandler: null }) {
    this._eventHandler = options.eventHandler
    this._bufferParser = new BufferParser()
    this._serverVersion = SERVER_VERSION
  }

  receiveMessage(message) {
    this._bufferParser.write(message)
  }

  decodeMessage() {
    this._bufferParser.process((err, methodName) => {
      if (err) throw err
      if (methodName && typeof this['_' + methodName] === 'function') this['_' + methodName]()
      else throw new Error('Unknown broker API response: ' + methodName)
    })
  }

  _emit() {
    this._eventHandler.emit(...arguments)
  }

  setServerVersion(version) {
    this._serverVersion = version
  }

  _HISTORICAL_TICKS_LAST() {
    let reqId = this._bufferParser.readAndShiftInt()
    let tickCount = this._bufferParser.readAndShiftInt()

    let ticks = []

    for (let i = 0; i < tickCount; i++) {
      let time = this._bufferParser.readAndShift()
      let mask = this._bufferParser.readAndShiftInt()
      let tickAttribLast = {}
      tickAttribLast.pastLimit = (mask & (1 << 0)) !== 0
      tickAttribLast.unreported = (mask & (1 << 1)) !== 0

      let price = this._bufferParser.readAndShiftFloat()
      let size = this._bufferParser.readAndShift()
      let exchange = this._bufferParser.readAndShift()
      let specialConditions = this._bufferParser.readAndShift()

      ticks.push({ time, tickAttribLast, price, size, exchange, specialConditions })
    }

    let done = this._bufferParser.readAndShiftBool()

    this._emit('historicalTicksLast', reqId, ticks, done)

  }

  _HISTORICAL_TICKS_BID_ASK() {
    let reqId = this._bufferParser.readAndShiftInt()
    let tickCount = this._bufferParser.readAndShiftInt()

    let ticks = []

    for (let i = 0; i < tickCount; i++) {
      let time = this._bufferParser.readAndShift()
      let mask = this._bufferParser.readAndShiftInt()

      let tickAttribBidAsk = {}
      tickAttribBidAsk.askPastHigh = (mask & (1 << 0)) !== 0
      tickAttribBidAsk.bidPastLow = (mask & (1 << 1)) !== 0

      let priceBid = this._bufferParser.readAndShiftFloat()
      let priceAsk = this._bufferParser.readAndShiftFloat()
      let sizeBid = this._bufferParser.readAndShift()
      let sizeAsk = this._bufferParser.readAndShift()

      ticks.push({ time, tickAttribBidAsk, priceBid, priceAsk, sizeBid, sizeAsk })
    }

    let done = this._bufferParser.readAndShiftBool()

    this._emit('historicalTicksBidAsk', reqId, ticks, done)

  }

  _HISTORICAL_TICKS() {
    let reqId = this._bufferParser.readAndShiftInt(),
      tickCount = this._bufferParser.readAndShiftInt()

    let ticks = []

    for (let i = 0; i < tickCount; i++) {
      let time = this._bufferParser.readAndShift()
      this._bufferParser.readAndShiftInt()//for consistency
      let price = this._bufferParser.readAndShiftFloat()
      let size = this._bufferParser.readAndShift()

      ticks.push({ time, price, size })
    }

    let done = this._bufferParser.readAndShiftBool()

    this._emit('historicalTicks', reqId, ticks, done)

  }

  _MARKET_RULE() {
    let marketRuleId = this._bufferParser.readAndShiftInt()
    let priceIncrements = [];
    let nPriceIncrements = this._bufferParser.readAndShiftInt()

    if (nPriceIncrements > 0) {
      for (let i = 0; i < nPriceIncrements; i++) {
        priceIncrements.push({ lowEdge: this._bufferParser.readAndShiftFloat(), increment: this._bufferParser.readAndShiftFloat() })
      }
    } else {
      priceIncrements = new PriceIncrement[0]
    }

    this._emit('marketRule', marketRuleId, priceIncrements)

  }

  _REROUTE_MKT_DEPTH_REQ() {
    let reqId = this._bufferParser.readAndShiftInt()
    let conId = this._bufferParser.readAndShiftInt()
    let exchange = this._bufferParser.readAndShift()

    this._emit('rerouteMktDepthReq', reqId, conId, exchange)

  }

  _REROUTE_MKT_DATA_REQ() {
    let reqId = this._bufferParser.readAndShiftInt()
    let conId = this._bufferParser.readAndShiftInt()
    let exchange = this._bufferParser.readAndShift()

    this._emit('rerouteMktDataReq', reqId, conId, exchange)

  }

  _HISTORICAL_DATA_UPDATE() {
    let reqId = this._bufferParser.readAndShiftInt()
    let barCount = this._bufferParser.readAndShiftInt()
    let date = this._bufferParser.readAndShift()
    let open = this._bufferParser.readAndShiftFloat()
    let close = this._bufferParser.readAndShiftFloat()
    let high = this._bufferParser.readAndShiftFloat()
    let low = this._bufferParser.readAndShiftFloat()
    let WAP = this._bufferParser.readAndShiftFloat()
    let volume = this._bufferParser.readAndShift()

    this._emit('historicalDataUpdate', reqId, new Bar(date, open, high, low, close, volume, barCount, WAP))

  }

  _PNL_SINGLE() {
    let reqId = this._bufferParser.readAndShiftInt()
    let pos = this._bufferParser.readAndShiftInt()
    let dailyPnL = this._bufferParser.readAndShiftFloat()
    let unrealizedPnL = Number.MAX_VALUE;
    let realizedPnL = Number.MAX_VALUE;

    if (this._serverVersion >= MIN_SERVER_VER.UNREALIZED_PNL) {
      unrealizedPnL = this._bufferParser.readAndShiftFloat()
    }

    if (this._serverVersion >= MIN_SERVER_VER.REALIZED_PNL) {
      realizedPnL = this._bufferParser.readAndShiftFloat()
    }

    let value = this._bufferParser.readAndShiftFloat()

    this._emit('pnlSingle', reqId, pos, dailyPnL, unrealizedPnL, realizedPnL, value)

  }

  _PNL() {
    let reqId = this._bufferParser.readAndShiftInt()
    let dailyPnL = this._bufferParser.readAndShiftFloat()
    let unrealizedPnL = Number.MAX_VALUE;
    let realizedPnL = Number.MAX_VALUE;

    if (this._serverVersion >= MIN_SERVER_VER.UNREALIZED_PNL) {
      unrealizedPnL = this._bufferParser.readAndShiftFloat()
    }

    if (this._serverVersion >= MIN_SERVER_VER.REALIZED_PNL) {
      realizedPnL = this._bufferParser.readAndShiftFloat()
    }

    this._emit('pnl', reqId, dailyPnL, unrealizedPnL, realizedPnL)
  }

  _HISTOGRAM_DATA() {
    let reqId = this._bufferParser.readAndShiftInt()
    let n = this._bufferParser.readAndShiftInt()
    let items = []

    for (let i = 0; i < n; i++) {
      items.push({ price: this._bufferParser.readAndShiftFloat(), size: this._bufferParser.readAndShift() })
    }

    this._emit('histogramData', reqId, items)
  }

  _HISTORICAL_NEWS_END() {
    let requestId = this._bufferParser.readAndShiftInt()
    let hasMore = this._bufferParser.readAndShiftBool()

    this._emit('historicalNewsEnd', requestId, hasMore)
  }

  _HISTORICAL_NEWS() {
    let requestId = this._bufferParser.readAndShiftInt()
    let time = this._bufferParser.readAndShift()
    let providerCode = this._bufferParser.readAndShift()
    let articleId = this._bufferParser.readAndShift()
    let headline = this._bufferParser.readAndShift()

    this._emit('historicalNews', requestId, time, providerCode, articleId, headline)

  }

  _NEWS_ARTICLE() {
    let requestId = this._bufferParser.readAndShiftInt()
    let articleType = this._bufferParser.readAndShiftInt()
    let articleText = this._bufferParser.readAndShift()

    this._emit('newsArticle', requestId, articleType, articleText)
  }

  _NEWS_PROVIDERS() {
    let newsProviders = []
    let nNewsProviders = this._bufferParser.readAndShiftInt()

    if (nNewsProviders > 0) {
      for (let i = 0; i < nNewsProviders; i++) {
        newsProviders.push({ code: this._bufferParser.readAndShift(), name: this._bufferParser.readAndShift() })
      }
    }

    this._emit('newsProviders', newsProviders)
  }

  _TICK_NEWS() {
    let tickerId = this._bufferParser.readAndShiftInt()
    let timeStamp = this._bufferParser.readAndShift()
    let providerCode = this._bufferParser.readAndShift()
    let articleId = this._bufferParser.readAndShift()
    let headline = this._bufferParser.readAndShift()
    let extraData = this._bufferParser.readAndShift()

    this._emit('tickNews', tickerId, timeStamp, providerCode, articleId, headline, extraData)

  }

  _HEAD_TIMESTAMP() {
    let reqId = this._bufferParser.readAndShiftInt()
    let headTimestamp = this._bufferParser.readAndShift()

    this._emit('headTimestamp', reqId, headTimestamp)
  }

  _MKT_DEPTH_EXCHANGES() {
    let depthMktDataDescriptions = [];
    let nDepthMktDataDescriptions = this._bufferParser.readAndShiftInt()

    if (nDepthMktDataDescriptions > 0) {

      for (let i = 0; i < nDepthMktDataDescriptions; i++) {
        if (this._serverVersion >= MIN_SERVER_VER.SERVICE_DATA_TYPE) {
          depthMktDataDescriptions.push({
            exchange: this._bufferParser.readAndShift(),
            secType: this._bufferParser.readAndShift(),
            listingExch: this._bufferParser.readAndShift(),
            serviceDataType: this._bufferParser.readAndShift(),
            aggGroup: this._bufferParser.readAndShiftInt() || Number.MAX_VALUE
          })
        } else {
          depthMktDataDescriptions.push({
            exchange: this._bufferParser.readAndShift(),
            secType: this._bufferParser.readAndShift(),
            listingExch: this._bufferParser.readAndShift(),
            serviceDataType: this._bufferParser.readAndShift(),
            aggGroup: this._bufferParser.readAndShiftInt() || Number.MAX_VALUE
          })
          depthMktDataDescriptions.push({
            exchange: this._bufferParser.readAndShift(),
            secType: this._bufferParser.readAndShift(),
            listingExch: "",
            serviceDataType: this._bufferParser.readAndShiftBool() ? "Deep2" : "Deep",
            aggGroup: Number.MAX_VALUE
          })
        }
      }
    }

    this._emit('mktDepthExchanges', depthMktDataDescriptions)
  }

  _SYMBOL_SAMPLES() {
    let reqId = this._bufferParser.readAndShiftInt()
    let contractDescriptions = [];
    let nContractDescriptions = this._bufferParser.readAndShiftInt()

    if (nContractDescriptions > 0) {
      for (let i = 0; i < nContractDescriptions; i++) {
        // read contract fields
        let contract = {};
        contract.conid(this._bufferParser.readAndShiftInt())
        contract.symbol(this._bufferParser.readAndShift())
        contract.secType(this._bufferParser.readAndShift())
        contract.primaryExch(this._bufferParser.readAndShift())
        contract.currency(this._bufferParser.readAndShift())

        // read derivative sec types list
        let derivativeSecTypes = []
        let nDerivativeSecTypes = this._bufferParser.readAndShiftInt()

        if (nDerivativeSecTypes > 0) {
          for (let j = 0; j < nDerivativeSecTypes; j++) {
            derivativeSecTypes.push(this._bufferParser.readAndShift())
          }
        }

        let contractDescription = { contract, derivativeSecTypes };
        contractDescriptions.push(contractDescription)
      }
    }

    this._emit('symbolSamples', reqId, contractDescriptions)
  }
  _FAMILY_CODES() {
    let familyCodes = [];
    let nFamilyCodes = this._bufferParser.readAndShiftInt()

    if (nFamilyCodes > 0) {

      for (let i = 0; i < nFamilyCodes; i++) {
        familyCodes.push({ accountId: this._bufferParser.readAndShift(), familyCode: this._bufferParser.readAndShift() })
      }
    }

    this._emit('familyCodes', familyCodes)
  }

  _SOFT_DOLLAR_TIERS() {
    let reqId = this._bufferParser.readAndShiftInt()
    let nTiers = this._bufferParser.readAndShiftInt()
    let tiers = [];

    for (let i = 0; i < nTiers; i++) {
      tiers.push({ name: this._bufferParser.readAndShift(), value: this._bufferParser.readAndShift(), displayName: this._bufferParser.readAndShift() })
    }

    this._emit('softDollarTiers', reqId, tiers)
  }

  _SECURITY_DEFINITION_OPTION_PARAMETER_END() {
    let reqId = this._bufferParser.readAndShiftInt()

    this._emit('securityDefinitionOptionalParameterEnd', reqId)
  }

  _SECURITY_DEFINITION_OPTION_PARAMETER() {
    let reqId = this._bufferParser.readAndShiftInt()
    let exchange = this._bufferParser.readAndShift()
    let underlyingConId = this._bufferParser.readAndShiftInt()
    let tradingClass = this._bufferParser.readAndShift()
    let multiplier = this._bufferParser.readAndShift()
    let expirationsSize = this._bufferParser.readAndShiftInt()
    let expirations = []
    let strikes = []

    for (let i = 0; i < expirationsSize; i++) {
      expirations.push(this._bufferParser.readAndShift())
    }

    let strikesSize = this._bufferParser.readAndShiftInt()

    for (let i = 0; i < strikesSize; i++) {
      strikes.push(this._bufferParser.readAndShiftFloat())
    }

    this._emit('securityDefinitionOptionParameter', reqId, exchange, underlyingConId, tradingClass, multiplier, expirations, strikes)

  }

  _VERIFY_AND_AUTH_COMPLETED() {
    let version = this._bufferParser.readAndShiftInt()
    let isSuccessfulStr = this._bufferParser.readAndShift()
    let isSuccessful = isSuccessfulStr === 'true'
    let errorText = this._bufferParser.readAndShift()

    this._emit('verifyAndAuthCompleted', isSuccessful, errorText)
  }

  _VERIFY_AND_AUTH_MESSAGE_API() {
    let version = this._bufferParser.readAndShiftInt()
    let apiData = this._bufferParser.readAndShift()
    let xyzChallenge = this._bufferParser.readAndShift()

    this._emit('verifyAndAuthMessageAPI', apiData, xyzChallenge)
  }

  _DISPLAY_GROUP_UPDATED() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    let contractInfo = this._bufferParser.readAndShift()

    this._emit('displayGroupUpdated', reqId, contractInfo)
  }

  _DISPLAY_GROUP_LIST() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    let groups = this._bufferParser.readAndShift()

    this._emit('displayGroupList', reqId, groups)
  }

  _VERIFY_COMPLETED() {
    let version = this._bufferParser.readAndShiftInt()
    let isSuccessfulStr = this._bufferParser.readAndShift()
    let isSuccessful = "true".equals(isSuccessfulStr)
    let errorText = this._bufferParser.readAndShift()
    this._emit('verifyCompleted', isSuccessful, errorText)
  }

  _VERIFY_MESSAGE_API() {
    let version = this._bufferParser.readAndShiftInt()
    let apiData = this._bufferParser.readAndShift()

    this._emit('verifyMessageAPI', apiData)
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

  _MARKET_DATA_TYPE() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    let marketDataType = this._bufferParser.readAndShiftInt()
    this._emit('marketDataType', reqId, marketDataType)
  }

  _TICK_SNAPSHOT_END() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    this._emit('tickSnapshotEnd', reqId)
  }

  _DELTA_NEUTRAL_VALIDATION() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    let deltaNeutralContract = {}
    deltaNeutralContract.conId = this._bufferParser.readAndShiftInt()
    deltaNeutralContract.delta = this._bufferParser.readAndShiftFloat()
    underdeltaNeutralContractComp.price = this._bufferParser.readAndShiftFloat()
    this._emit('deltaNeutralValidation', reqId, deltaNeutralContract)
  }

  _EXECUTION_DATA_END() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    this._emit('execDetailsEnd', reqId)
  }

  _ACCT_DOWNLOAD_END() {
    let version = this._bufferParser.readAndShiftInt()
    let accountName = this._bufferParser.readAndShift()
    this._emit('accountDownloadEnd', accountName)
  }

  _OPEN_ORDER_END() {
    let version = this._bufferParser.readAndShiftInt()
    this._emit('openOrderEnd')
  }


  _CONTRACT_DATA_END() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    this._emit('contractDetailsEnd', reqId)
  }

  _FUNDAMENTAL_DATA() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    let data = this._bufferParser.readAndShift()
    this._emit('fundamentalData', reqId, data)
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

  _CURRENT_TIME() {
    let version = this._bufferParser.readAndShiftInt()
    let time = this._bufferParser.readAndShiftInt()
    this._emit('currentTime', time)
  }

  _SCANNER_PARAMETERS() {
    let version = this._bufferParser.readAndShiftInt()
    let xml = this._bufferParser.readAndShift()
    this._emit('scannerParameters', xml)
  }

  _HISTORICAL_DATA() {
    let version = this._serverVersion < MIN_SERVER_VER.SYNT_REALTIME_BARS ? this._bufferParser.readAndShiftInt() : Number.MAX_VALUE
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
      volume = this._serverVersion < MIN_SERVER_VER.SYNT_REALTIME_BARS ? this._bufferParser.readAndShiftInt() : this._bufferParser.readAndShift()
      WAP = this._bufferParser.readAndShiftFloat()
      if (this._serverVersion < MIN_SERVER_VER.SYNT_REALTIME_BARS) {
      /*let hasGaps = */this._bufferParser.readAndShift()
      }

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
        WAP
      })
    }
    // send end of dataset marker
    this._emit('historicalDataEnd', reqId, startDateStr, endDateStr)
  }

  _RECEIVE_FA() {
    let version = this._bufferParser.readAndShiftInt()
    let faDataType = this._bufferParser.readAndShiftInt()
    let xml = this._bufferParser.readAndShift()
    this._emit('receiveFA', faDataType, xml)
  }

  _MANAGED_ACCTS() {
    let version = this._bufferParser.readAndShiftInt()
    let accountsList = this._bufferParser.readAndShift()
    this._emit('managedAccounts', accountsList)
  }

  _NEWS_BULLETINS() {
    let version = this._bufferParser.readAndShiftInt()
    let newsMsgId = this._bufferParser.readAndShiftInt()
    let newsMsgType = this._bufferParser.readAndShiftInt()
    let newsMessage = this._bufferParser.readAndShift()
    let originatingExch = this._bufferParser.readAndShift()
    this._emit('updateNewsBulletin', newsMsgId, newsMsgType, newsMessage, originatingExch)
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

    let isSmartDepth = this._serverVersion >= MIN_SERVER_VER.SMART_DEPTH ? this._bufferParser.readAndShiftBool() : false
    this._emit('updateMktDepthL2', id, position, marketMaker, operation, side, price, size, isSmartDepth)
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

  _EXECUTION_DATA() {
    let version = this._serverVersion < MIN_SERVER_VER.LAST_LIQUIDITY ? this._bufferParser.readAndShiftInt() : this._serverVersion
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


    exec.shares = this._serverVersion >= MIN_SERVER_VER.FRACTIONAL_POSITIONS ? this._bufferParser.readAndShiftFloat() : this._bufferParser.readAndShift()
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

    if (this._serverVersion >= MIN_SERVER_VER.MODELS_SUPPORT) {
      exec.modelCode = this._bufferParser.readAndShift()
    }

    if (this._serverVersion >= MIN_SERVER_VER.LAST_LIQUIDITY) {
      exec.lastLiquidity = this._bufferParser.readAndShiftInt()
    }


    this._emit('execDetails', reqId, contract, exec)
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
    if (this._serverVersion >= MIN_SERVER_VER.MD_SIZE_MULTIPLIER) {
      contract.mdSizeMultiplier = this._bufferParser.readAndShiftInt()
    }
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
    if (this._serverVersion >= MIN_SERVER_VER.AGG_GROUP) {
      contract.aggGroup = this._bufferParser.readAndShiftInt()
    }

    if (this._serverVersion >= MIN_SERVER_VER.MARKET_RULES) {
      contract.marketRuleIds = this._bufferParser.readAndShift()
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
    if (this._serverVersion >= MIN_SERVER_VER.MD_SIZE_MULTIPLIER) {
      contract.mdSizeMultiplier = this._bufferParser.readAndShiftInt()
    }
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

    if (this._serverVersion >= MIN_SERVER_VER.AGG_GROUP) {
      contract.aggGroup = this._bufferParser.readAndShiftInt()
    }
    if (this._serverVersion >= MIN_SERVER_VER.UNDERLYING_INFO) {
      contract.underSymbol = this._bufferParser.readAndShift()
      contract.underSecType = this._bufferParser.readAndShift()
    }
    if (this._serverVersion >= MIN_SERVER_VER.MARKET_RULES) {
      contract.marketRuleIds = this._bufferParser.readAndShift()
    }
    if (this._serverVersion >= MIN_SERVER_VER.REAL_EXPIRATION_DATE) {
      contract.realExpirationDate = this._bufferParser.readAndShift()
    }

    this._emit('contractDetails', reqId, contract)
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

  _NEXT_VALID_ID() {
    let version = this._bufferParser.readAndShiftInt()
    let orderId = this._bufferParser.readAndShiftInt()
    this._emit('nextValidId', orderId)
  }

  _OPEN_ORDER() {
    // read version
    let version = this._serverVersion < MIN_SERVER_VER.ORDER_CONTAINER ? this._bufferParser.readAndShiftInt() : this._serverVersion
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
    order.totalQuantity = this._serverVersion < MIN_SERVER_VER.FRACTIONAL_POSITIONS ? this._bufferParser.readAndShiftFloat() : this._bufferParser.readAndShiftInt()
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
    if (this._serverVersion >= MIN_SERVER_VER.MODELS_SUPPORT) {
      order.modelCode = this._bufferParser.readAndShift()
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
      if (this._serverVersion === 51) {
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
      if (this._serverVersion === 26) {
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
        deltaNeutralContract = {}
        deltaNeutralContract.conId = this._bufferParser.readAndShiftInt()
        deltaNeutralContract.delta = this._bufferParser.readAndShiftFloat()
        deltaNeutralContract.price = this._bufferParser.readAndShiftFloat()
        contract.deltaNeutralContract = deltaNeutralContract
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

    if (version >= 33) {
      order.solicited(this._bufferParser.readAndShiftBool())
    }

    let orderState = {}
    if (version >= 16) {
      order.whatIf = this._bufferParser.readAndShiftBool()
      orderState.status = this._bufferParser.readAndShift()
      if (this._serverVersion >= MIN_SERVER_VER.WHAT_IF_EXT_FIELDS) {
        orderState.initMarginBefore = this._bufferParser.readAndShift()
        orderState.maintMarginBefore = this._bufferParser.readAndShift()
        orderState.equityWithLoanBefore = this._bufferParser.readAndShift()
        orderState.initMarginChange = this._bufferParser.readAndShift()
        orderState.maintMarginChange = this._bufferParser.readAndShift()
        orderState.equityWithLoanChange = this._bufferParser.readAndShift()
      }
      orderState.initMargin = this._bufferParser.readAndShift()
      orderState.maintMargin = this._bufferParser.readAndShift()
      orderState.equityWithLoan = this._bufferParser.readAndShift()
      orderState.commission = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      orderState.minCommission = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      orderState.maxCommission = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      orderState.commissionCurrency = this._bufferParser.readAndShift()
      orderState.warningText = this._bufferParser.readAndShift()
    }

    if (version >= 34) {
      order.randomizeSize = this._bufferParser.readAndShiftBool()
      order.randomizePrice = this._bufferParser.readAndShiftBool()
    }

    if (this._serverVersion >= MIN_SERVER_VER.PEGGED_TO_BENCHMARK) {
      if (order.orderType === ORDER_TYPE.PEG_BENCH) {
        order.referenceContractId = this._bufferParser.readAndShiftInt()
        order.isPeggedChangeAmountDecrease = this._bufferParser.readAndShiftBool()
        order.peggedChangeAmount = this._bufferParser.readAndShiftFloat()
        order.referenceChangeAmount = this._bufferParser.readAndShiftFloat()
        order.referenceExchangeId = this._bufferParser.readAndShift()
      }

      let nConditions = this._bufferParser.readAndShiftInt()

      if (nConditions > 0) {
        for (let i = 0; i < nConditions; i++) {
          order.conditions.push(this._bufferParser.readAndShiftInt())
        }

        order.conditionsIgnoreRth = this._bufferParser.readAndShiftBool()
        order.conditionsCancelOrder = this._bufferParser.readAndShiftBool()
      }

      order.adjustedOrderType(ORDER_TYPE[this._bufferParser.readAndShift()])
      order.triggerPrice = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.trailStopPrice = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.lmtPriceOffset = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.adjustedStopPrice = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.adjustedStopLimitPrice = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.adjustedTrailingAmount = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
      order.adjustableTrailingUnit = this._bufferParser.readAndShiftInt()
    }

    if (this._serverVersion >= MIN_SERVER_VER.SOFT_DOLLAR_TIER) {
      order.softDollarTier = ({
        name: this._bufferParser.readAndShift(), value: this._bufferParser.readAndShift(), displayName: this._bufferParser.readAndShift()
      })
    }

    if (this._serverVersion >= MIN_SERVER_VER.CASH_QTY) {
      order.cashQty = this._bufferParser.readAndShiftFloat() || Number.MAX_VALUE
    }

    if (this._serverVersion >= MIN_SERVER_VER.AUTO_PRICE_FOR_HEDGE) {
      order.dontUseAutoPriceForHedge = this._bufferParser.readAndShiftBool()
    }

    if (this._serverVersion >= MIN_SERVER_VER.ORDER_CONTAINER) {
      order.isOmsContainer = this._bufferParser.readAndShiftBool()
    }

    if (this._serverVersion >= MIN_SERVER_VER.D_PEG_ORDERS) {
      order.discretionaryUpToLimitPrice = this._bufferParser.readAndShiftBool()
    }



    this._emit('openOrder', order.orderId, contract, order, orderState)
  }

  _ERR_MSG() {
    let errorCode
    let errorMsg
    let id
    let version = this._bufferParser.readAndShiftInt()
    if (version < 2) {
      errorMsg = this._bufferParser.readAndShift()
      this._emit('error', errorMsg)
    } else {
      id = this._bufferParser.readAndShiftInt()
      errorCode = this._bufferParser.readAndShiftInt()
      errorMsg = this._bufferParser.readAndShift()
      this._emit('error', {
        id: id,
        code: errorCode,
        message: errorMsg
      })
    }
  }

  _ACCT_UPDATE_TIME() {
    let version = this._bufferParser.readAndShiftInt()
    let timeStamp = this._bufferParser.readAndShift()
    this._emit('updateAccountTime', timeStamp)
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
    let position = this._serverVersion >= MIN_SERVER_VER.FRACTIONAL_POSITIONS ? this._bufferParser.readAndShiftFloat() : this._bufferParser.readAndShiftInt()
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
    if (version === 6 && this._serverVersion === 39) {
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

  _ORDER_STATUS() {
    let version = this._serverVersion >= MIN_SERVER_VER.MARKET_CAP_PRICE ? Number.MAX_VALUE : this._bufferParser.readAndShiftInt()
    let id = this._bufferParser.readAndShiftInt()
    let status = this._bufferParser.readAndShift()
    let filled = this._serverVersion >= MIN_SERVER_VER.FRACTIONAL_POSITIONS ? this._bufferParser.readAndShiftFloat() : this._bufferParser.readAndShiftInt()
    let remaining = this._serverVersion >= MIN_SERVER_VER.FRACTIONAL_POSITIONS ? this._bufferParser.readAndShiftFloat() : this._bufferParser.readAndShiftInt()
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

    let mktCapPrice = this._serverVersion >= MIN_SERVER_VER.MARKET_CAP_PRICE ? this._bufferParser.readAndShiftFloat() : Number.MAX_VALUE
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
      whyHeld,
      mktCapPrice
    )
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

  _TICK_STRING() {
    let version = this._bufferParser.readAndShiftInt()
    let tickerId = this._bufferParser.readAndShiftInt()
    let tickType = this._bufferParser.readAndShiftInt()
    let value = this._bufferParser.readAndShift()
    this._emit('tickString', tickerId, tickType, value)
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

  _ACCOUNT_SUMMARY_END() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    this._emit('accountSummaryEnd', reqId)
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

  _POSITION_END() {
    let version = this._bufferParser.readAndShiftInt()
    this._emit('positionEnd')
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
    let pos = this._serverVersion >= MIN_SERVER_VER.FRACTIONAL_POSITIONS ? this._bufferParser.readAndShiftFloat() : this._bufferParser.readAndShiftInt()
    let avgCost = 0
    if (version >= 3) {
      avgCost = this._bufferParser.readAndShiftFloat()
    }
    this._emit('position', account, contract, pos, avgCost)
  }

  _TICK_SIZE() {
    let version = this._bufferParser.readAndShiftInt()
    let tickerId = this._bufferParser.readAndShiftInt()
    let tickType = this._bufferParser.readAndShiftInt()
    let size = this._bufferParser.readAndShiftInt()
    this._emit('tickSize', tickerId, tickType, size)
  }

  _TICK_PRICE() {
    let version = this._bufferParser.readAndShiftInt()
    let tickerId = this._bufferParser.readAndShiftInt()
    let tickType = this._bufferParser.readAndShiftInt()
    let price = this._bufferParser.readAndShiftFloat()
    let size = 0
    let attribs = {}

    if (version >= 2) {
      size = this._bufferParser.readAndShiftInt()
    }

    if (version >= 3) {
      let mask = this._bufferParser.readAndShiftInt()

      attribs.canAutoExecute = (mask & (1 << 0)) !== 0

      if (this._serverVersion >= MIN_SERVER_VER.PAST_LIMIT) {
        attribs.pastLimit = (mask & (1 << 1)) !== 0
        if (this._serverVersion >= MIN_SERVER_VER.PRE_OPEN_BID_ASK) {
          attribs.preOpen = (mask & (1 << 2)) !== 0
        }
      }
    }

    this._emit('tickPrice', tickerId, tickType, price, attribs)
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
        case 66: // DELAYED_BID
          sizeTickType = 69; // DELAYED_BID_SIZE
          break;
        case 67: // DELAYED_ASK
          sizeTickType = 70; // DELAYED_ASK_SIZE
          break;
        case 68: // DELAYED_LAST
          sizeTickType = 71; // DELAYED_LAST_SIZE
          break;
        default:
          break
      }
      if (sizeTickType !== -1) {
        this._emit('tickSize', tickerId, sizeTickType, size)
      }
    }
  }

  _POSITION_MULTI() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
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
    contract.tradingClass = this._bufferParser.readAndShift()
    let pos = this._bufferParser.readAndShiftFloat()
    let avgCost = this._bufferParser.readAndShiftFloat()
    let modelCode = this._bufferParser.readAndShift()
    this._emit('positionMulti', reqId, account, modelCode, contract, pos, avgCost)
  }


  _POSITION_MULTI_END() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShiftInt()
    this._emit('positionMultiEnd', reqId)
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

  _ACCOUNT_UPDATE_MULTI_END() {
    let version = this._bufferParser.readAndShiftInt()
    let reqId = this._bufferParser.readAndShift()
    this._emit('accountUpdateMultiEnd', reqId)
  }

  _SMART_COMPONENTS() {
    let reqId = this._bufferParser.readAndShiftInt()
    let n = this._bufferParser.readAndShiftInt()
    let theMap = []

    for (let i = 0; i < n; i++) {
      let bitNumber = this._bufferParser.readAndShiftInt()
      let exchange = this._bufferParser.readAndShift()
      let exchangeLetter = this._bufferParser.readAndShift()

      theMap.push({ bitNumber, exhange: { exchange, exchangeLetter } })
    }

    this._emit('smartComponents', reqId, theMap)
  }

  _TICK_REQ_PARAMS() {
    let tickerId = this._bufferParser.readAndShiftInt()
    let minTick = this._bufferParser.readAndShiftFloat()
    let bboExchange = this._bufferParser.readAndShift()
    let snapshotPermissions = this._bufferParser.readAndShiftInt()
    this._emit('tickReqParams', tickerId, minTick, bboExchange, snapshotPermissions)
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

  _ORDER_BOUND() {
    let orderId = this._bufferParser.readAndShift()
    let apiClientId = this._bufferParser.readAndShiftInt()
    let apiOrderId = this._bufferParser.readAndShiftInt()
    this._emit('orderBound', orderId, apiClientId, apiOrderId)
  }
}

export default MessageDecoder
