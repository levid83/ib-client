import { isEmpty } from 'lodash'
import { SERVER_VERSION, TICK_TYPE, MIN_SERVER_VER, ORDER_TYPE } from './constants'
import BufferParser from './BufferParser'

class MessageDecoder {
  constructor(options = { eventHandler: null }) {
    this._eventHandler = options.eventHandler
    this._serverVersion = SERVER_VERSION
  }

  _emit() {
    this._eventHandler.emit(...arguments)
  }

  setServerVersion(version) {
    this._serverVersion = version
  }

  decodeMessage(data) {
    let buffer = new BufferParser(data)
    buffer.process((err, methodName) => {
      if (err) throw err
      if (methodName && typeof this['_' + methodName] === 'function') this['_' + methodName](buffer)
      else throw new Error('Unknown broker API response: ' + methodName)
    })
  }

  decodeServerVersion(data) {
    let buffer = new BufferParser(data)
    buffer.readLengthHeader()
    let serverVersion = buffer.readInt()
    let connectionTime = buffer.readString()
    return { serverVersion, connectionTime }
  }

  _HISTORICAL_TICKS_LAST(buffer) {
    let reqId = buffer.readInt()
    let tickCount = buffer.readInt()

    let ticks = []

    for (let i = 0; i < tickCount; i++) {
      let time = buffer.readString()
      let mask = buffer.readInt()
      let tickAttribLast = {}
      tickAttribLast.pastLimit = (mask & (1 << 0)) !== 0
      tickAttribLast.unreported = (mask & (1 << 1)) !== 0

      let price = buffer.readFloat()
      let size = buffer.readInt()
      let exchange = buffer.readString()
      let specialConditions = buffer.readString()

      ticks.push({ time, tickAttribLast, price, size, exchange, specialConditions })
    }

    let done = buffer.readBool()

    this._emit('historicalTicksLast', reqId, ticks, done)
  }

  _HISTORICAL_TICKS_BID_ASK(buffer) {
    let reqId = buffer.readInt()
    let tickCount = buffer.readInt()

    let ticks = []

    for (let i = 0; i < tickCount; i++) {
      let time = buffer.readString()
      let mask = buffer.readInt()

      let tickAttribBidAsk = {}
      tickAttribBidAsk.askPastHigh = (mask & (1 << 0)) !== 0
      tickAttribBidAsk.bidPastLow = (mask & (1 << 1)) !== 0

      let priceBid = buffer.readFloat()
      let priceAsk = buffer.readFloat()
      let sizeBid = buffer.readInt()
      let sizeAsk = buffer.readInt()

      ticks.push({ time, tickAttribBidAsk, priceBid, priceAsk, sizeBid, sizeAsk })
    }

    let done = buffer.readBool()

    this._emit('historicalTicksBidAsk', reqId, ticks, done)
  }

  _HISTORICAL_TICKS(buffer) {
    let reqId = buffer.readInt(),
      tickCount = buffer.readInt()

    let ticks = []

    for (let i = 0; i < tickCount; i++) {
      let time = buffer.readString()
      buffer.readInt() //for consistency
      let price = buffer.readFloat()
      let size = buffer.readInt()

      ticks.push({ time, price, size })
    }

    let done = buffer.readBool()

    this._emit('historicalTicks', reqId, ticks, done)
  }

  _MARKET_RULE(buffer) {
    let marketRuleId = buffer.readInt()
    let priceIncrements = []
    let nPriceIncrements = buffer.readInt()

    if (nPriceIncrements > 0) {
      for (let i = 0; i < nPriceIncrements; i++) {
        priceIncrements.push({
          lowEdge: buffer.readFloat(),
          increment: buffer.readFloat()
        })
      }
    } else {
      priceIncrements = new PriceIncrement[0]()
    }

    this._emit('marketRule', marketRuleId, priceIncrements)
  }

  _REROUTE_MKT_DEPTH_REQ(buffer) {
    let reqId = buffer.readInt()
    let conId = buffer.readInt()
    let exchange = buffer.readString()

    this._emit('rerouteMktDepthReq', reqId, conId, exchange)
  }

  _REROUTE_MKT_DATA_REQ(buffer) {
    let reqId = buffer.readInt()
    let conId = buffer.readInt()
    let exchange = buffer.readString()

    this._emit('rerouteMktDataReq', reqId, conId, exchange)
  }

  _HISTORICAL_DATA_UPDATE(buffer) {
    let reqId = buffer.readInt()
    let barCount = buffer.readInt()
    let date = buffer.readString()
    let open = buffer.readFloat()
    let close = buffer.readFloat()
    let high = buffer.readFloat()
    let low = buffer.readFloat()
    let WAP = buffer.readFloat()
    let volume = buffer.readString()

    this._emit(
      'historicalDataUpdate',
      reqId,
      new Bar(date, open, high, low, close, volume, barCount, WAP)
    )
  }

  _PNL_SINGLE(buffer) {
    let reqId = buffer.readInt()
    let pos = buffer.readInt()
    let dailyPnL = buffer.readFloat()
    let unrealizedPnL = Number.MAX_VALUE
    let realizedPnL = Number.MAX_VALUE

    if (this._serverVersion >= MIN_SERVER_VER.UNREALIZED_PNL) {
      unrealizedPnL = buffer.readFloat()
    }

    if (this._serverVersion >= MIN_SERVER_VER.REALIZED_PNL) {
      realizedPnL = buffer.readFloat()
    }

    let value = buffer.readFloat()

    this._emit('pnlSingle', reqId, pos, dailyPnL, unrealizedPnL, realizedPnL, value)
  }

  _PNL(buffer) {
    let reqId = buffer.readInt()
    let dailyPnL = buffer.readFloat()
    let unrealizedPnL = Number.MAX_VALUE
    let realizedPnL = Number.MAX_VALUE

    if (this._serverVersion >= MIN_SERVER_VER.UNREALIZED_PNL) {
      unrealizedPnL = buffer.readFloat()
    }

    if (this._serverVersion >= MIN_SERVER_VER.REALIZED_PNL) {
      realizedPnL = buffer.readFloat()
    }

    this._emit('pnl', reqId, dailyPnL, unrealizedPnL, realizedPnL)
  }

  _HISTOGRAM_DATA(buffer) {
    let reqId = buffer.readInt()
    let n = buffer.readInt()
    let items = []

    for (let i = 0; i < n; i++) {
      items.push({ price: buffer.readFloat(), size: buffer.readInt() })
    }

    this._emit('histogramData', reqId, items)
  }

  _HISTORICAL_NEWS_END(buffer) {
    let requestId = buffer.readInt()
    let hasMore = buffer.readBool()

    this._emit('historicalNewsEnd', requestId, hasMore)
  }

  _HISTORICAL_NEWS(buffer) {
    let requestId = buffer.readInt()
    let time = buffer.readString()
    let providerCode = buffer.readString()
    let articleId = buffer.readString()
    let headline = buffer.readString()

    this._emit('historicalNews', requestId, time, providerCode, articleId, headline)
  }

  _NEWS_ARTICLE(buffer) {
    let requestId = buffer.readInt()
    let articleType = buffer.readInt()
    let articleText = buffer.readString()

    this._emit('newsArticle', requestId, articleType, articleText)
  }

  _NEWS_PROVIDERS(buffer) {
    let newsProviders = []
    let nNewsProviders = buffer.readInt()

    if (nNewsProviders > 0) {
      for (let i = 0; i < nNewsProviders; i++) {
        newsProviders.push({ code: buffer.readString(), name: buffer.readString() })
      }
    }

    this._emit('newsProviders', newsProviders)
  }

  _TICK_NEWS(buffer) {
    let tickerId = buffer.readInt()
    let timeStamp = buffer.readString()
    let providerCode = buffer.readString()
    let articleId = buffer.readString()
    let headline = buffer.readString()
    let extraData = buffer.readString()

    this._emit('tickNews', tickerId, timeStamp, providerCode, articleId, headline, extraData)
  }

  _HEAD_TIMESTAMP(buffer) {
    let reqId = buffer.readInt()
    let headTimestamp = buffer.readString()

    this._emit('headTimestamp', reqId, headTimestamp)
  }

  _MKT_DEPTH_EXCHANGES(buffer) {
    let depthMktDataDescriptions = []
    let nDepthMktDataDescriptions = buffer.readInt()

    if (nDepthMktDataDescriptions > 0) {
      for (let i = 0; i < nDepthMktDataDescriptions; i++) {
        if (this._serverVersion >= MIN_SERVER_VER.SERVICE_DATA_TYPE) {
          depthMktDataDescriptions.push({
            exchange: buffer.readString(),
            secType: buffer.rereadStringad(),
            listingExch: buffer.readString(),
            serviceDataType: buffer.readString(),
            aggGroup: buffer.readIntMax()
          })
        } else {
          depthMktDataDescriptions.push({
            exchange: buffer.readString(),
            secType: buffer.readString(),
            listingExch: '',
            serviceDataType: buffer.readBool() ? 'Deep2' : 'Deep',
            aggGroup: Number.MAX_VALUE
          })
        }
      }
    }

    this._emit('mktDepthExchanges', depthMktDataDescriptions)
  }

  _SYMBOL_SAMPLES(buffer) {
    let reqId = buffer.readInt()
    let contractDescriptions = []
    let nContractDescriptions = buffer.readInt()

    if (nContractDescriptions > 0) {
      for (let i = 0; i < nContractDescriptions; i++) {
        // read contract fields
        let contract = {}
        contract.conid = buffer.readInt()
        contract.symbol = buffer.readString()
        contract.secType = buffer.readString()
        contract.primaryExch = buffer.readString()
        contract.currency = buffer.readString()

        // read derivative sec types list
        let derivativeSecTypes = []
        let nDerivativeSecTypes = buffer.readInt()

        if (nDerivativeSecTypes > 0) {
          for (let j = 0; j < nDerivativeSecTypes; j++) {
            derivativeSecTypes.push(buffer.readString())
          }
        }

        let contractDescription = { contract, derivativeSecTypes }
        contractDescriptions.push(contractDescription)
      }
    }

    this._emit('symbolSamples', reqId, contractDescriptions)
  }
  _FAMILY_CODES(buffer) {
    let familyCodes = []
    let nFamilyCodes = buffer.readInt()

    if (nFamilyCodes > 0) {
      for (let i = 0; i < nFamilyCodes; i++) {
        familyCodes.push({ accountId: buffer.readString(), familyCode: buffer.readString() })
      }
    }

    this._emit('familyCodes', familyCodes)
  }

  _SOFT_DOLLAR_TIERS(buffer) {
    let reqId = buffer.readInt()
    let nTiers = buffer.readInt()
    let tiers = []

    for (let i = 0; i < nTiers; i++) {
      tiers.push({
        name: buffer.readString(),
        value: buffer.readString(),
        displayName: buffer.readString()
      })
    }

    this._emit('softDollarTiers', reqId, tiers)
  }

  _SECURITY_DEFINITION_OPTION_PARAMETER_END(buffer) {
    let reqId = buffer.readInt()

    this._emit('securityDefinitionOptionParameterEnd', reqId)
  }

  _SECURITY_DEFINITION_OPTION_PARAMETER(buffer) {
    let reqId = buffer.readInt()
    let exchange = buffer.readString()
    let underlyingConId = buffer.readInt()
    let tradingClass = buffer.readString()
    let multiplier = buffer.readString()
    let expirationsSize = buffer.readInt()
    let expirations = []
    let strikes = []

    for (let i = 0; i < expirationsSize; i++) {
      expirations.push(buffer.readString())
    }

    let strikesSize = buffer.readInt()

    for (let i = 0; i < strikesSize; i++) {
      strikes.push(buffer.readFloat())
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

  _VERIFY_AND_AUTH_COMPLETED(buffer) {
    let version = buffer.readInt()
    let isSuccessfulStr = buffer.readString()
    let isSuccessful = isSuccessfulStr === 'true'
    let errorText = buffer.readString()

    this._emit('verifyAndAuthCompleted', isSuccessful, errorText)
  }

  _VERIFY_AND_AUTH_MESSAGE_API(buffer) {
    let version = buffer.readInt()
    let apiData = buffer.readString()
    let xyzChallenge = buffer.readString()

    this._emit('verifyAndAuthMessageAPI', apiData, xyzChallenge)
  }

  _DISPLAY_GROUP_UPDATED(buffer) {
    let version = buffer.readInt()
    let reqId = buffer.readInt()
    let contractInfo = buffer.readString()

    this._emit('displayGroupUpdated', reqId, contractInfo)
  }

  _DISPLAY_GROUP_LIST(buffer) {
    let version = buffer.readInt()
    let reqId = buffer.readInt()
    let groups = buffer.readString()

    this._emit('displayGroupList', reqId, groups)
  }

  _VERIFY_COMPLETED(buffer) {
    let version = buffer.readInt()
    let isSuccessfulStr = buffer.readString()
    let isSuccessful = 'true'.equals(isSuccessfulStr)
    let errorText = buffer.readString()
    this._emit('verifyCompleted', isSuccessful, errorText)
  }

  _VERIFY_MESSAGE_API(buffer) {
    let version = buffer.readInt()
    let apiData = buffer.readString()

    this._emit('verifyMessageAPI', apiData)
  }

  _COMMISSION_REPORT(buffer) {
    let version = buffer.readInt()
    let commissionReport = {}
    commissionReport.execId = buffer.readString()
    commissionReport.commission = buffer.readFloat()
    commissionReport.currency = buffer.readString()
    commissionReport.realizedPNL = buffer.readFloat()
    commissionReport.yield = buffer.readFloat()
    commissionReport.yieldRedemptionDate = buffer.readInt()
    this._emit('commissionReport', commissionReport)
  }

  _MARKET_DATA_TYPE(buffer) {
    let version = buffer.readInt()
    let reqId = buffer.readInt()
    let marketDataType = buffer.readInt()
    this._emit('marketDataType', reqId, marketDataType)
  }

  _TICK_SNAPSHOT_END(buffer) {
    let version = buffer.readInt()
    let reqId = buffer.readInt()
    this._emit('tickSnapshotEnd', reqId)
  }

  _DELTA_NEUTRAL_VALIDATION(buffer) {
    let version = buffer.readInt()
    let reqId = buffer.readInt()
    let deltaNeutralContract = {}
    deltaNeutralContract.conId = buffer.readInt()
    deltaNeutralContract.delta = buffer.readFloat()
    underdeltaNeutralContractComp.price = buffer.readFloat()
    this._emit('deltaNeutralValidation', reqId, deltaNeutralContract)
  }

  _EXECUTION_DATA_END(buffer) {
    let version = buffer.readInt()
    let reqId = buffer.readInt()
    this._emit('execDetailsEnd', reqId)
  }

  _ACCT_DOWNLOAD_END(buffer) {
    let version = buffer.readInt()
    let accountName = buffer.readString()
    this._emit('accountDownloadEnd', accountName)
  }

  _OPEN_ORDER_END(buffer) {
    let version = buffer.readInt()
    this._emit('openOrderEnd')
  }

  _CONTRACT_DATA_END(buffer) {
    let version = buffer.readInt()
    let reqId = buffer.readInt()
    this._emit('contractDetailsEnd', reqId)
  }

  _FUNDAMENTAL_DATA(buffer) {
    let version = buffer.readInt()
    let reqId = buffer.readInt()
    let data = buffer.readString()
    this._emit('fundamentalData', reqId, data)
  }

  _REAL_TIME_BARS(buffer) {
    let version = buffer.readInt()
    let reqId = buffer.readInt()
    let time = buffer.readString()
    let open = buffer.readFloat()
    let high = buffer.readFloat()
    let low = buffer.readFloat()
    let close = buffer.readFloat()
    let volume = buffer.readInt()
    let wap = buffer.readFloat()
    let count = buffer.readInt()
    this._emit('realtimeBar', reqId, time, open, high, low, close, volume, wap, count)
  }

  _CURRENT_TIME(buffer) {
    let version = buffer.readInt()
    let time = buffer.readString()
    this._emit('currentTime', time)
  }

  _SCANNER_PARAMETERS(buffer) {
    let version = buffer.readInt()
    let xml = buffer.readString()
    this._emit('scannerParameters', xml)
  }

  _HISTORICAL_DATA(buffer) {
    let version =
      this._serverVersion < MIN_SERVER_VER.SYNT_REALTIME_BARS ? buffer.readInt() : Number.MAX_VALUE
    let reqId = buffer.readInt()
    let completedIndicator = 'finished'
    let startDateStr
    let endDateStr
    if (version >= 2) {
      startDateStr = buffer.readString()
      endDateStr = buffer.readString()
      completedIndicator += '-' + startDateStr + '-' + endDateStr
    }
    let itemCount = buffer.readInt()
    let date
    let open
    let high
    let low
    let close
    let volume
    let WAP
    let barCount
    while (itemCount--) {
      date = buffer.readString()
      open = buffer.readFloat()
      high = buffer.readFloat()
      low = buffer.readFloat()
      close = buffer.readFloat()
      volume =
        this._serverVersion < MIN_SERVER_VER.SYNT_REALTIME_BARS
          ? buffer.readInt()
          : buffer.readString()
      WAP = buffer.readFloat()
      if (this._serverVersion < MIN_SERVER_VER.SYNT_REALTIME_BARS) {
        /*let hasGaps = */ buffer.readString()
      }

      barCount = -1
      if (version >= 3) {
        barCount = buffer.readInt()
      }
      this._emit('historicalData', reqId, { date, open, high, low, close, volume, barCount, WAP })
    }
    // send end of dataset marker
    this._emit('historicalDataEnd', reqId, startDateStr, endDateStr)
  }

  _RECEIVE_FA(buffer) {
    let version = buffer.readInt()
    let faDataType = buffer.readInt()
    let xml = buffer.readString()
    this._emit('receiveFA', faDataType, xml)
  }

  _MANAGED_ACCTS(buffer) {
    let version = buffer.readInt()
    let accountsList = buffer.readString()
    this._emit('managedAccounts', accountsList)
  }

  _NEWS_BULLETINS(buffer) {
    let version = buffer.readInt()
    let newsMsgId = buffer.readInt()
    let newsMsgType = buffer.readInt()
    let newsMessage = buffer.readString()
    let originatingExch = buffer.readString()
    this._emit('updateNewsBulletin', newsMsgId, newsMsgType, newsMessage, originatingExch)
  }

  _MARKET_DEPTH_L2(buffer) {
    let version = buffer.readInt()
    let id = buffer.readInt()
    let position = buffer.readInt()
    let marketMaker = buffer.readString()
    let operation = buffer.readInt()
    let side = buffer.readInt()
    let price = buffer.readFloat()
    let size = buffer.readInt()

    let isSmartDepth = this._serverVersion >= MIN_SERVER_VER.SMART_DEPTH ? buffer.readBool() : false
    this._emit(
      'updateMktDepthL2',
      id,
      position,
      marketMaker,
      operation,
      side,
      price,
      size,
      isSmartDepth
    )
  }

  _MARKET_DEPTH(buffer) {
    let version = buffer.readInt()
    let id = buffer.readInt()
    let position = buffer.readInt()
    let operation = buffer.readInt()
    let side = buffer.readInt()
    let price = buffer.readFloat()
    let size = buffer.readInt()
    this._emit('updateMktDepth', id, position, operation, side, price, size)
  }

  _EXECUTION_DATA(buffer) {
    let version =
      this._serverVersion < MIN_SERVER_VER.LAST_LIQUIDITY ? buffer.readInt() : this._serverVersion
    let reqId = -1
    if (version >= 7) {
      reqId = buffer.readInt()
    }
    let orderId = buffer.readInt()
    // read contract fields
    let contract = {}
    if (version >= 5) {
      contract.conId = buffer.readInt()
    }
    contract.symbol = buffer.readString()
    contract.secType = buffer.readString()
    contract.expiry = buffer.readString()
    contract.strike = buffer.readFloat()
    contract.right = buffer.readString()
    if (version >= 9) {
      contract.multiplier = buffer.readString()
    }
    contract.exchange = buffer.readString()
    contract.currency = buffer.readString()
    contract.localSymbol = buffer.readString()
    if (version >= 10) {
      contract.tradingClass = buffer.readString()
    }
    let exec = {}
    exec.orderId = orderId
    exec.execId = buffer.readString()
    exec.time = buffer.readString()
    exec.acctNumber = buffer.readString()
    exec.exchange = buffer.readString()
    exec.side = buffer.readString()

    exec.shares =
      this._serverVersion >= MIN_SERVER_VER.FRACTIONAL_POSITIONS
        ? buffer.readFloat()
        : buffer.readInt()
    exec.price = buffer.readFloat()
    if (version >= 2) {
      exec.permId = buffer.readInt()
    }
    if (version >= 3) {
      exec.clientId = buffer.readInt()
    }
    if (version >= 4) {
      exec.liquidation = buffer.readInt()
    }
    if (version >= 6) {
      exec.cumQty = buffer.readFloat()
      exec.avgPrice = buffer.readFloat()
    }
    if (version >= 8) {
      exec.orderRef = buffer.readString()
    }
    if (version >= 9) {
      exec.evRule = buffer.readString()
      exec.evMultiplier = buffer.readFloat()
    }

    if (this._serverVersion >= MIN_SERVER_VER.MODELS_SUPPORT) {
      exec.modelCode = buffer.readString()
    }

    if (this._serverVersion >= MIN_SERVER_VER.LAST_LIQUIDITY) {
      exec.lastLiquidity = buffer.readInt()
    }

    this._emit('execDetails', reqId, contract, exec)
  }

  _BOND_CONTRACT_DATA(buffer) {
    let version = buffer.readInt()
    let reqId = -1
    if (version >= 3) {
      reqId = buffer.readInt()
    }
    let contract = {
      summary: {}
    }
    contract.summary.symbol = buffer.readString()
    contract.summary.secType = buffer.readString()
    contract.cusip = buffer.readString()
    contract.coupon = buffer.readFloat()
    contract.maturity = buffer.readString()
    contract.issueDate = buffer.readString()
    contract.ratings = buffer.readString()
    contract.bondType = buffer.readString()
    contract.couponType = buffer.readString()
    contract.convertible = buffer.readBool()
    contract.callable = buffer.readBool()
    contract.putable = buffer.readBool()
    contract.descAppend = buffer.readString()
    contract.summary.exchange = buffer.readString()
    contract.summary.currency = buffer.readString()
    contract.marketName = buffer.readString()
    contract.summary.tradingClass = buffer.readString()
    contract.summary.conId = buffer.readInt()
    contract.minTick = buffer.readFloat()
    if (this._serverVersion >= MIN_SERVER_VER.MD_SIZE_MULTIPLIER) {
      contract.mdSizeMultiplier = buffer.readInt()
    }
    contract.orderTypes = buffer.readString()
    contract.validExchanges = buffer.readString()
    if (version >= 2) {
      contract.nextOptionDate = buffer.readString()
      contract.nextOptionType = buffer.readString()
      contract.nextOptionPartial = buffer.readBool()
      contract.notes = buffer.readString()
    }
    if (version >= 4) {
      contract.longName = buffer.readString()
    }
    if (version >= 6) {
      contract.evRule = buffer.readString()
      contract.evMultiplier = buffer.readFloat()
    }
    let secIdListCount
    let tagValue
    if (version >= 5) {
      secIdListCount = buffer.readInt()
      if (secIdListCount > 0) {
        contract.secIdList = []
        while (secIdListCount--) {
          tagValue = {}
          tagValue.tag = buffer.readString()
          tagValue.value = buffer.readString()
          contract.secIdList.push(tagValue)
        }
      }
    }
    if (this._serverVersion >= MIN_SERVER_VER.AGG_GROUP) {
      contract.aggGroup = buffer.readInt()
    }

    if (this._serverVersion >= MIN_SERVER_VER.MARKET_RULES) {
      contract.marketRuleIds = buffer.readString()
    }
    this._emit('bondContractDetails', reqId, contract)
  }

  _CONTRACT_DATA(buffer) {
    let version = buffer.readInt()
    let reqId = -1
    if (version >= 3) {
      reqId = buffer.readInt()
    }
    let contract = {
      summary: {}
    }
    contract.summary.symbol = buffer.readString()
    contract.summary.secType = buffer.readString()
    contract.summary.expiry = buffer.readString()
    contract.summary.strike = buffer.readFloat()
    contract.summary.right = buffer.readString()
    contract.summary.exchange = buffer.readString()
    contract.summary.currency = buffer.readString()
    contract.summary.localSymbol = buffer.readString()
    contract.marketName = buffer.readString()
    contract.summary.tradingClass = buffer.readString()
    contract.summary.conId = buffer.readInt()
    contract.minTick = buffer.readFloat()
    if (this._serverVersion >= MIN_SERVER_VER.MD_SIZE_MULTIPLIER) {
      contract.mdSizeMultiplier = buffer.readInt()
    }
    contract.summary.multiplier = buffer.readString()
    contract.orderTypes = buffer.readString()
    contract.validExchanges = buffer.readString()
    if (version >= 2) {
      contract.priceMagnifier = buffer.readInt()
    }
    if (version >= 4) {
      contract.underConId = buffer.readInt()
    }
    if (version >= 5) {
      contract.longName = buffer.readString()
      contract.summary.primaryExch = buffer.readString()
    }
    if (version >= 6) {
      contract.contractMonth = buffer.readString()
      contract.industry = buffer.readString()
      contract.category = buffer.readString()
      contract.subcategory = buffer.readString()
      contract.timeZoneId = buffer.readString()
      contract.tradingHours = buffer.readString()
      contract.liquidHours = buffer.readString()
    }
    if (version >= 8) {
      contract.evRule = buffer.readString()
      contract.evMultiplier = buffer.readFloat()
    }
    let secIdListCount
    let tagValue

    if (version >= 7) {
      secIdListCount = buffer.readInt()
      if (secIdListCount > 0) {
        contract.secIdList = []
        for (let i = 0; i < secIdListCount; ++i) {
          tagValue = {}
          tagValue.tag = buffer.readString()
          tagValue.value = buffer.readString()
          contract.secIdList.push(tagValue)
        }
      }
    }

    if (this._serverVersion >= MIN_SERVER_VER.AGG_GROUP) {
      contract.aggGroup = buffer.readInt()
    }
    if (this._serverVersion >= MIN_SERVER_VER.UNDERLYING_INFO) {
      contract.underSymbol = buffer.readString()
      contract.underSecType = buffer.readString()
    }
    if (this._serverVersion >= MIN_SERVER_VER.MARKET_RULES) {
      contract.marketRuleIds = buffer.readString()
    }
    if (this._serverVersion >= MIN_SERVER_VER.REAL_EXPIRATION_DATE) {
      contract.realExpirationDate = buffer.readString()
    }

    this._emit('contractDetails', reqId, contract)
  }

  _SCANNER_DATA(buffer) {
    let version = buffer.readInt()
    let tickerId = buffer.readInt()
    let numberOfElements = buffer.readInt()
    let rank
    while (numberOfElements--) {
      let contract = {
        summary: {}
      }
      rank = buffer.readInt()
      if (version >= 3) {
        contract.summary.conId = buffer.readInt()
      }
      contract.summary.symbol = buffer.readString()
      contract.summary.secType = buffer.readString()
      contract.summary.expiry = buffer.readString()
      contract.summary.strike = buffer.readFloat()
      contract.summary.right = buffer.readString()
      contract.summary.exchange = buffer.readString()
      contract.summary.currency = buffer.readString()
      contract.summary.localSymbol = buffer.readString()
      contract.marketName = buffer.readString()
      contract.summary.tradingClass = buffer.readString()
      let distance = buffer.readString()
      let benchmark = buffer.readString()
      let projection = buffer.readString()
      let legsStr = null
      if (version >= 2) {
        legsStr = buffer.readString()
      }
      this._emit('scannerData', tickerId, rank, contract, distance, benchmark, projection, legsStr)
    }
    this._emit('scannerDataEnd', tickerId)
  }

  _NEXT_VALID_ID(buffer) {
    let version = buffer.readInt()
    let orderId = buffer.readInt()
    this._emit('nextValidId', orderId)
  }

  _OPEN_ORDER(buffer) {
    // read version
    let version =
      this._serverVersion < MIN_SERVER_VER.ORDER_CONTAINER ? buffer.readInt() : this._serverVersion
    // read order id
    let order = {}
    order.orderId = buffer.readInt()
    // read contract fields
    let contract = {}
    if (version >= 17) {
      contract.conId = buffer.readInt()
    }
    contract.symbol = buffer.readString()
    contract.secType = buffer.readString()
    contract.expiry = buffer.readString()
    contract.strike = buffer.readFloat()
    contract.right = buffer.readString()
    if (version >= 32) {
      contract.multiplier = buffer.readString()
    }
    contract.exchange = buffer.readString()
    contract.currency = buffer.readString()
    if (version >= 2) {
      contract.localSymbol = buffer.readString()
    }
    if (version >= 32) {
      contract.tradingClass = buffer.readString()
    }
    // read order fields
    order.action = buffer.readString()
    order.totalQuantity =
      this._serverVersion < MIN_SERVER_VER.FRACTIONAL_POSITIONS
        ? buffer.readFloat()
        : buffer.readInt()
    order.orderType = buffer.readString()
    if (version < 29) {
      order.lmtPrice = buffer.readFloat()
    } else {
      order.lmtPrice = buffer.readFloatMax()
    }
    if (version < 30) {
      order.auxPrice = buffer.readFloat()
    } else {
      order.auxPrice = buffer.readFloatMax()
    }
    order.tif = buffer.readString()
    order.ocaGroup = buffer.readString()
    order.account = buffer.readString()
    order.openClose = buffer.readString()
    order.origin = buffer.readString()
    order.orderRef = buffer.readString()
    if (version >= 3) {
      order.clientId = buffer.readInt()
    }
    if (version >= 4) {
      order.permId = buffer.readInt()
      if (version < 18) {
        // will never happen
        /* order.ignoreRth = */
        buffer.readBool()
      } else {
        order.outsideRth = buffer.readBool()
      }
      order.hidden = buffer.readBool()
      order.discretionaryAmt = buffer.readFloat()
    }
    if (version >= 5) {
      order.goodAfterTime = buffer.readString()
    }
    if (version >= 6) {
      // skip deprecated sharesAllocation field
      buffer.readString()
    }
    if (version >= 7) {
      order.faGroup = buffer.readString()
      order.faMethod = buffer.readString()
      order.faPercentage = buffer.readString()
      order.faProfile = buffer.readString()
    }
    if (this._serverVersion >= MIN_SERVER_VER.MODELS_SUPPORT) {
      order.modelCode = buffer.readString()
    }
    if (version >= 8) {
      order.goodTillDate = buffer.readString()
    }
    if (version >= 9) {
      order.rule80A = buffer.readString()
      order.percentOffset = buffer.readFloatMax()
      order.settlingFirm = buffer.readString()
      order.shortSaleSlot = buffer.readInt()
      order.designatedLocation = buffer.readString()
      if (this._serverVersion === 51) {
        buffer.readInt() // exemptCode
      } else if (version >= 23) {
        order.exemptCode = buffer.readInt()
      }
      order.auctionStrategy = buffer.readInt()
      order.startingPrice = buffer.readFloatMax()
      order.stockRefPrice = buffer.readFloatMax()
      order.delta = buffer.readFloatMax()
      order.stockRangeLower = buffer.readFloatMax()
      order.stockRangeUpper = buffer.readFloatMax()
      order.displaySize = buffer.readInt()
      if (version < 18) {
        // will never happen
        /* order.rthOnly = */
        buffer.readBool()
      }
      order.blockOrder = buffer.readBool()
      order.sweepToFill = buffer.readBool()
      order.allOrNone = buffer.readBool()
      order.minQty = buffer.readIntMax()
      order.ocaType = buffer.readInt()
      order.eTradeOnly = buffer.readBool()
      order.firmQuoteOnly = buffer.readBool()
      order.nbboPriceCap = buffer.readFloatMax()
    }
    if (version >= 10) {
      order.parentId = buffer.readInt()
      order.triggerMethod = buffer.readInt()
    }
    let receivedInt
    if (version >= 11) {
      order.volatility = buffer.readFloatMax()
      order.volatilityType = buffer.readInt()
      if (version === 11) {
        receivedInt = buffer.readInt()
        order.deltaNeutralOrderType = receivedInt === 0 ? 'NONE' : 'MKT'
      } else {
        // version 12 and up
        order.deltaNeutralOrderType = buffer.readString()
        order.deltaNeutralAuxPrice = buffer.readFloatMax()
        if (version >= 27 && !isEmpty(order.deltaNeutralOrderType)) {
          order.deltaNeutralConId = buffer.readInt()
          order.deltaNeutralSettlingFirm = buffer.readString()
          order.deltaNeutralClearingAccount = buffer.readString()
          order.deltaNeutralClearingIntent = buffer.readString()
        }
        if (version >= 31 && !isEmpty(order.deltaNeutralOrderType)) {
          order.deltaNeutralOpenClose = buffer.readString()
          order.deltaNeutralShortSale = buffer.readBool()
          order.deltaNeutralShortSaleSlot = buffer.readInt()
          order.deltaNeutralDesignatedLocation = buffer.readString()
        }
      }
      order.continuousUpdate = buffer.readInt()
      if (this._serverVersion === 26) {
        order.stockRangeLower = buffer.readFloat()
        order.stockRangeUpper = buffer.readFloat()
      }
      order.referencePriceType = buffer.readInt()
    }
    if (version >= 13) {
      order.trailStopPrice = buffer.readFloatMax()
    }
    if (version >= 30) {
      order.trailingPercent = buffer.readFloatMax()
    }
    if (version >= 14) {
      order.basisPoints = buffer.readFloatMax()
      order.basisPointsType = buffer.readIntMax()
      contract.comboLegsDescrip = buffer.readString()
    }
    let comboLeg
    let comboLegsCount
    let orderComboLeg
    let orderComboLegsCount
    if (version >= 29) {
      comboLegsCount = buffer.readInt()
      if (comboLegsCount > 0) {
        contract.comboLegs = []
        for (let i = 0; i < comboLegsCount; ++i) {
          comboLeg = {}
          comboLeg.conId = buffer.readInt()
          comboLeg.ratio = buffer.readInt()
          comboLeg.action = buffer.readString()
          comboLeg.exchange = buffer.readString()
          comboLeg.openClose = buffer.readInt()
          comboLeg.shortSaleSlot = buffer.readInt()
          comboLeg.designatedLocation = buffer.readString()
          comboLeg.exemptCode = buffer.readInt()
          contract.comboLegs.push(comboLeg)
        }
      }
      orderComboLegsCount = buffer.readInt()
      if (orderComboLegsCount > 0) {
        order.orderComboLegs = []
        for (let i = 0; i < orderComboLegsCount; ++i) {
          orderComboLeg = {}
          order.price = buffer.readFloatMax()
          order.orderComboLegs.push(orderComboLeg)
        }
      }
    }
    let smartComboRoutingParamsCount
    let tagValue
    if (version >= 26) {
      smartComboRoutingParamsCount = buffer.readInt()
      if (smartComboRoutingParamsCount > 0) {
        order.smartComboRoutingParams = []
        for (let i = 0; i < smartComboRoutingParamsCount; ++i) {
          tagValue = {}
          tagValue.tag = buffer.readString()
          tagValue.value = buffer.readString()
          order.smartComboRoutingParams.push(tagValue)
        }
      }
    }
    if (version >= 15) {
      if (version >= 20) {
        order.scaleInitLevelSize = buffer.readIntMax()
        order.scaleSubsLevelSize = buffer.readIntMax()
      } else {
        let notSuppScaleNumComponents = buffer.readIntMax()
        order.scaleInitLevelSize = buffer.readIntMax()
      }
      order.scalePriceIncrement = buffer.readFloatMax()
    }
    if (
      version >= 28 &&
      order.scalePriceIncrement > 0.0 &&
      order.scalePriceIncrement !== Number.MAX_VALUE
    ) {
      order.scalePriceAdjustValue = buffer.readFloatMax()
      order.scalePriceAdjustInterval = buffer.readIntMax()
      order.scaleProfitOffset = buffer.readFloatMax()
      order.scaleAutoReset = buffer.readBool()
      order.scaleInitPosition = buffer.readIntMax()
      order.scaleInitFillQty = buffer.readIntMax()
      order.scaleRandomPercent = buffer.readBool()
    }
    if (version >= 24) {
      order.hedgeType = buffer.readString()
      if (!isEmpty(order.hedgeType)) {
        order.hedgeParam = buffer.readString()
      }
    }
    if (version >= 25) {
      order.optOutSmartRouting = buffer.readBool()
    }
    if (version >= 19) {
      order.clearingAccount = buffer.readString()
      order.clearingIntent = buffer.readString()
    }
    if (version >= 22) {
      order.notHeld = buffer.readBool()
    }
    let underComp
    if (version >= 20) {
      if (buffer.readBool()) {
        deltaNeutralContract = {}
        deltaNeutralContract.conId = buffer.readInt()
        deltaNeutralContract.delta = buffer.readFloat()
        deltaNeutralContract.price = buffer.readFloat()
        contract.deltaNeutralContract = deltaNeutralContract
      }
    }
    let algoParamsCount
    if (version >= 21) {
      order.algoStrategy = buffer.readString()
      if (!isEmpty(order.algoStrategy)) {
        algoParamsCount = buffer.readInt()
        if (algoParamsCount > 0) {
          order.algoParams = []
          for (let i = 0; i < algoParamsCount; ++i) {
            tagValue = {}
            tagValue.tag = buffer.readString()
            tagValue.value = buffer.readString()
            order.algoParams.push(tagValue)
          }
        }
      }
    }

    if (version >= 33) {
      order.solicited = buffer.readBool()
    }

    let orderState = {}
    if (version >= 16) {
      order.whatIf = buffer.readBool()
      orderState.status = buffer.readString()
      if (this._serverVersion >= MIN_SERVER_VER.WHAT_IF_EXT_FIELDS) {
        orderState.initMarginBefore = buffer.readString()
        orderState.maintMarginBefore = buffer.readString()
        orderState.equityWithLoanBefore = buffer.readString()
        orderState.initMarginChange = buffer.readString()
        orderState.maintMarginChange = buffer.readString()
        orderState.equityWithLoanChange = buffer.readString()
      }
      orderState.initMargin = buffer.readString()
      orderState.maintMargin = buffer.readString()
      orderState.equityWithLoan = buffer.readString()
      orderState.commission = buffer.readFloatMax()
      orderState.minCommission = buffer.readFloatMax()
      orderState.maxCommission = buffer.readFloatMax()
      orderState.commissionCurrency = buffer.readString()
      orderState.warningText = buffer.readString()
    }

    if (version >= 34) {
      order.randomizeSize = buffer.readBool()
      order.randomizePrice = buffer.readBool()
    }

    if (this._serverVersion >= MIN_SERVER_VER.PEGGED_TO_BENCHMARK) {
      if (order.orderType === ORDER_TYPE.PEG_BENCH) {
        order.referenceContractId = buffer.readInt()
        order.isPeggedChangeAmountDecrease = buffer.readBool()
        order.peggedChangeAmount = buffer.readFloat()
        order.referenceChangeAmount = buffer.readFloat()
        order.referenceExchangeId = buffer.readString()
      }

      let nConditions = buffer.readInt()

      if (nConditions > 0) {
        order.conditions = []
        for (let i = 0; i < nConditions; i++) {
          order.conditions.push(buffer.readInt())
        }

        order.conditionsIgnoreRth = buffer.readBool()
        order.conditionsCancelOrder = buffer.readBool()
      }

      order.adjustedOrderType = ORDER_TYPE[buffer.readString()]
      order.triggerPrice = buffer.readFloatMax()
      order.trailStopPrice = buffer.readFloatMax()
      order.lmtPriceOffset = buffer.readFloatMax()
      order.adjustedStopPrice = buffer.readFloatMax()
      order.adjustedStopLimitPrice = buffer.readFloatMax()
      order.adjustedTrailingAmount = buffer.readFloatMax()
      order.adjustableTrailingUnit = buffer.readInt()
    }

    if (this._serverVersion >= MIN_SERVER_VER.SOFT_DOLLAR_TIER) {
      order.softDollarTier = {
        name: buffer.readString(),
        value: buffer.readString(),
        displayName: buffer.readString()
      }
    }

    if (this._serverVersion >= MIN_SERVER_VER.CASH_QTY) {
      order.cashQty = buffer.readFloatMax()
    }

    if (this._serverVersion >= MIN_SERVER_VER.AUTO_PRICE_FOR_HEDGE) {
      order.dontUseAutoPriceForHedge = buffer.readBool()
    }

    if (this._serverVersion >= MIN_SERVER_VER.ORDER_CONTAINER) {
      order.isOmsContainer = buffer.readBool()
    }

    if (this._serverVersion >= MIN_SERVER_VER.D_PEG_ORDERS) {
      order.discretionaryUpToLimitPrice = buffer.readBool()
    }

    this._emit('openOrder', order.orderId, contract, order, orderState)
  }

  _ERR_MSG(buffer) {
    let errorCode
    let errorMsg
    let id
    let version = buffer.readInt()
    if (version < 2) {
      errorMsg = buffer.readString()
      this._emit('error', errorMsg)
    } else {
      id = buffer.readInt()
      errorCode = buffer.readInt()
      errorMsg = buffer.readString()
      this._emit('error', {
        id: id,
        code: errorCode,
        message: errorMsg
      })
    }
  }

  _ACCT_UPDATE_TIME(buffer) {
    let version = buffer.readInt()
    let timeStamp = buffer.readString()
    this._emit('updateAccountTime', timeStamp)
  }

  _PORTFOLIO_VALUE(buffer) {
    let version = buffer.readInt()
    let contract = {}
    if (version >= 6) {
      contract.conId = buffer.readInt()
    }
    contract.symbol = buffer.readString()
    contract.secType = buffer.readString()
    contract.expiry = buffer.readString()
    contract.strike = buffer.readFloat()
    contract.right = buffer.readString()
    if (version >= 7) {
      contract.multiplier = buffer.readString()
      contract.primaryExch = buffer.readString()
    }
    contract.currency = buffer.readString()
    if (version >= 2) {
      contract.localSymbol = buffer.readString()
    }
    if (version >= 8) {
      contract.tradingClass = buffer.readString()
    }
    let position =
      this._serverVersion >= MIN_SERVER_VER.FRACTIONAL_POSITIONS
        ? buffer.readFloat()
        : buffer.readInt()
    let marketPrice = buffer.readFloat()
    let marketValue = buffer.readFloat()
    let averageCost = 0.0
    let unrealizedPNL = 0.0
    let realizedPNL = 0.0
    if (version >= 3) {
      averageCost = buffer.readFloat()
      unrealizedPNL = buffer.readFloat()
      realizedPNL = buffer.readFloat()
    }
    let accountName = null
    if (version >= 4) {
      accountName = buffer.readString()
    }
    if (version === 6 && this._serverVersion === 39) {
      contract.primaryExch = buffer.readString()
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

  _ACCT_VALUE(buffer) {
    let version = buffer.readInt()
    let key = buffer.readString()
    let value = buffer.readString()
    let currency = buffer.readString()
    let accountName = null
    if (version >= 2) {
      accountName = buffer.readString()
    }
    this._emit('updateAccountValue', key, value, currency, accountName)
  }

  _ORDER_STATUS(buffer) {
    let version =
      this._serverVersion >= MIN_SERVER_VER.MARKET_CAP_PRICE ? Number.MAX_VALUE : buffer.readInt()
    let id = buffer.readInt()
    let status = buffer.readString()
    let filled =
      this._serverVersion >= MIN_SERVER_VER.FRACTIONAL_POSITIONS
        ? buffer.readFloat()
        : buffer.readInt()
    let remaining =
      this._serverVersion >= MIN_SERVER_VER.FRACTIONAL_POSITIONS
        ? buffer.readFloat()
        : buffer.readInt()
    let avgFillPrice = buffer.readFloat()
    let permId = 0
    if (version >= 2) {
      permId = buffer.readInt()
    }
    let parentId = 0
    if (version >= 3) {
      parentId = buffer.readInt()
    }
    let lastFillPrice = 0
    if (version >= 4) {
      lastFillPrice = buffer.readFloat()
    }
    let clientId = 0
    if (version >= 5) {
      clientId = buffer.readInt()
    }
    let whyHeld = null
    if (version >= 6) {
      whyHeld = buffer.readString()
    }

    let mktCapPrice =
      this._serverVersion >= MIN_SERVER_VER.MARKET_CAP_PRICE ? buffer.readFloat() : Number.MAX_VALUE
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

  _TICK_EFP(buffer) {
    let version = buffer.readInt()
    let tickerId = buffer.readInt()
    let tickType = buffer.readInt()
    let basisPoints = buffer.readFloat()
    let formattedBasisPoints = buffer.readString()
    let impliedFuturesPrice = buffer.readFloat()
    let holdDays = buffer.readInt()
    let futureExpiry = buffer.readString()
    let dividendImpact = buffer.readFloat()
    let dividendsToExpiry = buffer.readFloat()
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

  _TICK_STRING(buffer) {
    let version = buffer.readInt()
    let tickerId = buffer.readInt()
    let tickType = buffer.readInt()
    let value = buffer.readString()
    this._emit('tickString', tickerId, tickType, value)
  }

  _TICK_GENERIC(buffer) {
    let version = buffer.readInt()
    let tickerId = buffer.readInt()
    let tickType = buffer.readInt()
    let value = buffer.readFloat()
    this._emit('tickGeneric', tickerId, tickType, value)
  }

  _TICK_OPTION_COMPUTATION(buffer) {
    let version = buffer.readInt()
    let tickerId = buffer.readInt()
    let tickType = buffer.readInt()
    let impliedVol = buffer.readFloat()
    if (impliedVol < 0) {
      // -1 is the "not yet computed" indicator
      impliedVol = Number.MAX_VALUE
    }
    let delta = buffer.readFloat()
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
      optPrice = buffer.readFloat()
      if (optPrice < 0) {
        // -1 is the "not yet computed" indicator
        optPrice = Number.MAX_VALUE
      }
      pvDividend = buffer.readFloat()
      if (pvDividend < 0) {
        // -1 is the "not yet computed" indicator
        pvDividend = Number.MAX_VALUE
      }
    }
    if (version >= 6) {
      gamma = buffer.readFloat()
      if (Math.abs(gamma) > 1) {
        // -2 is the "not yet computed" indicator
        gamma = Number.MAX_VALUE
      }
      vega = buffer.readFloat()
      if (Math.abs(vega) > 1) {
        // -2 is the "not yet computed" indicator
        vega = Number.MAX_VALUE
      }
      theta = buffer.readFloat()
      if (Math.abs(theta) > 1) {
        // -2 is the "not yet computed" indicator
        theta = Number.MAX_VALUE
      }
      undPrice = buffer.readFloat()
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

  _ACCOUNT_SUMMARY_END(buffer) {
    let version = buffer.readInt()
    let reqId = buffer.readInt()
    this._emit('accountSummaryEnd', reqId)
  }

  _ACCOUNT_SUMMARY(buffer) {
    let version = buffer.readInt()
    let reqId = buffer.readInt()
    let account = buffer.readString()
    let tag = buffer.readString()
    let value = buffer.readString()
    let currency = buffer.readString()
    this._emit('accountSummary', reqId, account, tag, value, currency)
  }

  _POSITION_END(buffer) {
    let version = buffer.readInt()
    this._emit('positionEnd')
  }

  _POSITION(buffer) {
    let version = buffer.readInt()
    let account = buffer.readString()
    let contract = {}
    contract.conId = buffer.readInt()
    contract.symbol = buffer.readString()
    contract.secType = buffer.readString()
    contract.expiry = buffer.readString()
    contract.strike = buffer.readFloat()
    contract.right = buffer.readString()
    contract.multiplier = buffer.readString()
    contract.exchange = buffer.readString()
    contract.currency = buffer.readString()
    contract.localSymbol = buffer.readString()
    if (version >= 2) {
      contract.tradingClass = buffer.readString()
    }
    let pos =
      this._serverVersion >= MIN_SERVER_VER.FRACTIONAL_POSITIONS
        ? buffer.readFloat()
        : buffer.readInt()
    let avgCost = 0
    if (version >= 3) {
      avgCost = buffer.readFloat()
    }
    this._emit('position', account, contract, pos, avgCost)
  }

  _TICK_SIZE(buffer) {
    let version = buffer.readInt()
    let tickerId = buffer.readInt()
    let tickType = buffer.readInt()
    let size = buffer.readInt()
    this._emit('tickSize', tickerId, tickType, size)
  }

  _TICK_PRICE(buffer) {
    let version = buffer.readInt()
    let tickerId = buffer.readInt()
    let tickType = buffer.readInt()
    let price = buffer.readFloat()
    let size = 0
    let attribs = {}

    if (version >= 2) {
      size = buffer.readInt()
    }

    if (version >= 3) {
      let mask = buffer.readInt()

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
          sizeTickType = 69 // DELAYED_BID_SIZE
          break
        case 67: // DELAYED_ASK
          sizeTickType = 70 // DELAYED_ASK_SIZE
          break
        case 68: // DELAYED_LAST
          sizeTickType = 71 // DELAYED_LAST_SIZE
          break
        default:
          break
      }
      if (sizeTickType !== -1) {
        this._emit('tickSize', tickerId, sizeTickType, size)
      }
    }
  }

  _POSITION_MULTI(buffer) {
    let version = buffer.readInt()
    let reqId = buffer.readInt()
    let account = buffer.readString()

    let contract = {}
    contract.conId = buffer.readInt()
    contract.symbol = buffer.readString()
    contract.secType = buffer.readString()
    contract.expiry = buffer.readString()
    contract.strike = buffer.readFloat()
    contract.right = buffer.readString()
    contract.multiplier = buffer.readString()
    contract.exchange = buffer.readString()
    contract.currency = buffer.readString()
    contract.localSymbol = buffer.readString()
    contract.tradingClass = buffer.readString()
    let pos = buffer.readFloat()
    let avgCost = buffer.readFloat()
    let modelCode = buffer.readString()
    this._emit('positionMulti', reqId, account, modelCode, contract, pos, avgCost)
  }

  _POSITION_MULTI_END(buffer) {
    let version = buffer.readInt()
    let reqId = buffer.readInt()
    this._emit('positionMultiEnd', reqId)
  }

  _ACCOUNT_UPDATE_MULTI(buffer) {
    let version = buffer.readInt()
    let reqId = buffer.readInt()
    let account = buffer.readString()
    let modelCode = buffer.readString()
    let key = buffer.readString()
    let value = buffer.readString()
    let currency = buffer.readString()
    this._emit('accountUpdateMulti', reqId, account, modelCode, key, value, currency)
  }

  _ACCOUNT_UPDATE_MULTI_END(buffer) {
    let version = buffer.readInt()
    let reqId = buffer.readInt()
    this._emit('accountUpdateMultiEnd', reqId)
  }

  _SMART_COMPONENTS(buffer) {
    let reqId = buffer.readInt()
    let n = buffer.readInt()
    let theMap = []

    for (let i = 0; i < n; i++) {
      let bitNumber = buffer.readInt()
      let exchange = buffer.readString()
      let exchangeLetter = buffer.readString()

      theMap.push({ bitNumber, exhange: { exchange, exchangeLetter } })
    }

    this._emit('smartComponents', reqId, theMap)
  }

  _TICK_REQ_PARAMS(buffer) {
    let tickerId = buffer.readInt()
    let minTick = buffer.readFloat()
    let bboExchange = buffer.readString()
    let snapshotPermissions = buffer.readInt()
    this._emit('tickReqParams', tickerId, minTick, bboExchange, snapshotPermissions)
  }

  _TICK_BY_TICK(buffer) {
    let reqId = buffer.readInt()
    let tickType = buffer.readInt()
    let time = buffer.readString()
    let mask
    switch (tickType) {
      case 0: // None
        break
      case 1: // Last
      case 2: // Alllast
        let price = buffer.readFloat()
        let size = buffer.readInt()
        mask = buffer.readInt()
        let pastLimit = (mask & (1 << 0)) !== 0
        let unreported = (mask & (1 << 1)) !== 0
        let exchange = buffer.readString()
        let specialConditions = buffer.readString()
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
        let bidPrice = buffer.readFloat()
        let askPrice = buffer.readFloat()
        let bidSize = buffer.readInt()
        let askSize = buffer.readInt()
        mask = buffer.readInt()
        let bidPastLow = (mask & (1 << 0)) !== 0
        let askPastHigh = (mask & (1 << 1)) !== 0
        this._emit('tickByTickBidAsk', reqId, time, bidPrice, askPrice, bidSize, askSize, {
          bidPastLow,
          askPastHigh
        })
        break
      case 4: // MidPoint
        let midPoint = buffer.readFloat()
        this._emit('tickByTickMidPoint', reqId, time, midPoint)
        break
    }
  }

  _ORDER_BOUND(buffer) {
    let orderId = buffer.readInt()
    let apiClientId = buffer.readInt()
    let apiOrderId = buffer.readInt()
    this._emit('orderBound', orderId, apiClientId, apiOrderId)
  }
}

export default MessageDecoder
