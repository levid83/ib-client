import { isEmpty, isPlainObject } from 'lodash'

import { MIN_SERVER_VER, OUTGOING, BAG_SEC_TYPE } from './constants'


class MessageEncoder {
    constructor(options = { eventHandler: null, queue:null} ){
        this._eventHandler= options.eventHandler
        this._queue = options.queue
        this._serverVersion=null
    }

    _emitError(errorMessage, data){
        this._eventHandler.emit('error', new Error(errorMessage),data)
    }

    _nullifyMax(number) {
        if (number === Number.MAX_VALUE) {
            return null
        } else {
            return number
        }
    }

    encodeMessage(){
        var a = Array.from(arguments)
        let func = a[0]
        let args = a.slice(1)
        if (typeof this[func] !== 'function')
            throw new Error('Unknown broker API request  - ' + func)
        return { func, args, message: this[func](...args)}
    }

    sendMessage(message) {
        this._queue.push(message)
    }

    setServerVersion(version){
        this._serverVersion= version
    }
    sendClientVersion(clientId){
        return [clientId]
    }

    sendClientId(clientVersion) {
        return [clientVersion]
    }

    calculateImpliedVolatility(reqId, contract, optionPrice, underPrice) {
        if (this._serverVersion < MIN_SERVER_VER.REQ_CALC_IMPLIED_VOLAT) {
            return this._emitError(
                'It does not support calculate implied volatility requests.'
            )
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass)) {
                return this._emitError(
                    'It does not support tradingClass parameter in calculateImpliedVolatility.'
                )
            }
        }
        let version = 2
        let buffer = [OUTGOING.REQ_CALC_IMPLIED_VOLAT, version, reqId]
        // send contract fields
        buffer.push(contract.conId)
        buffer.push(contract.symbol)
        buffer.push(contract.secType)
        buffer.push(contract.expiry)
        buffer.push(contract.strike)
        buffer.push(contract.right)
        buffer.push(contract.multiplier)
        buffer.push(contract.exchange)
        buffer.push(contract.primaryExch)
        buffer.push(contract.currency)
        buffer.push(contract.localSymbol)
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(contract.tradingClass)
        }
        buffer.push(optionPrice)
        buffer.push(underPrice)

        return buffer
    }
    calculateOptionPrice(reqId, contract, volatility, underPrice) {
        if (this._serverVersion < MIN_SERVER_VER.REQ_CALC_OPTION_PRICE) {
            return this._emitError('It does not support calculate option price requests.')
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass)) {
                return this._emitError(
                    'It does not support tradingClass parameter in calculateOptionPrice.'
                )
            }
        }
        let version = 2
        let buffer = [OUTGOING.REQ_CALC_OPTION_PRICE, version, reqId]
        // send contract fields
        buffer.push(contract.conId)
        buffer.push(contract.symbol)
        buffer.push(contract.secType)
        buffer.push(contract.expiry)
        buffer.push(contract.strike)
        buffer.push(contract.right)
        buffer.push(contract.multiplier)
        buffer.push(contract.exchange)
        buffer.push(contract.primaryExch)
        buffer.push(contract.currency)
        buffer.push(contract.localSymbol)
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(contract.tradingClass)
        }
        buffer.push(volatility)
        buffer.push(underPrice)
        
        return buffer
    }
    cancelAccountSummary(reqId) {
        if (this._serverVersion < MIN_SERVER_VER.ACCT_SUMMARY) {
            return this._emitError('It does not support account summary cancellation.')
        }
        let version = 1
        let buffer = [OUTGOING.CANCEL_ACCOUNT_SUMMARY, version, reqId]

        return buffer
    }
    cancelAccountUpdatesMulti(reqId) {
        let version = 2
        let buffer = [OUTGOING.CANCEL_ACCOUNT_UPDATES_MULTI, version, reqId]

        return buffer
    }
    cancelPositionsMulti(reqId) {
        let version = 2
        let buffer = [OUTGOING.CANCEL_POSITIONS_MULTI, version, reqId]

        return buffer
    }
    cancelCalculateImpliedVolatility(reqId) {
        if (this._serverVersion < MIN_SERVER_VER.CANCEL_CALC_IMPLIED_VOLAT) {
            return this._emitError(
                'It does not support calculate implied volatility cancellation.'
            )
        }
        let version = 1
        let buffer = [OUTGOING.CANCEL_CALC_IMPLIED_VOLAT, version, reqId]

        return buffer
    }
    cancelCalculateOptionPrice(reqId) {
        if (this._serverVersion < MIN_SERVER_VER.CANCEL_CALC_OPTION_PRICE) {
            return this._emitError('It does not support calculate option price cancellation.')
        }
        let version = 1
        let buffer = [OUTGOING.CANCEL_CALC_OPTION_PRICE, version, reqId]

        return buffer
    }
    cancelFundamentalData(reqId) {
        if (this._serverVersion < MIN_SERVER_VER.FUNDAMENTAL_DATA) {
            return this._emitError('It does not support fundamental data requests.')
        }
        let version = 1
        let buffer = [OUTGOING.CANCEL_FUNDAMENTAL_DATA, version, reqId]

        return buffer
    }
    cancelHistoricalData(tickerId) {
        if (this._serverVersion < 24) {
            return this._emitError('It does not support historical data query cancellation.')
        }
        let version = 1
        let buffer = [OUTGOING.CANCEL_HISTORICAL_DATA, version, tickerId]

        return buffer
    }
    cancelMktData(tickerId) {
        let version = 1
        let buffer = [OUTGOING.CANCEL_MKT_DATA, version, tickerId]

        return buffer
    }
    cancelMktDepth(tickerId) {
        if (this._serverVersion < 6) {
            return this._emitError('This feature is only available for versions of TWS >=6.')
        }
        let version = 1
        let buffer = [OUTGOING.CANCEL_MKT_DEPTH, version, tickerId]

        return buffer
    }
    cancelNewsBulletins() {
        let version = 1
        let buffer = [OUTGOING.CANCEL_NEWS_BULLETINS, version]

        return buffer
    }
    cancelOrder(id) {
        let version = 1
        let buffer = [OUTGOING.CANCEL_ORDER, version, id]

        return buffer
    }
    cancelPositions() {
        if (this._serverVersion < MIN_SERVER_VER.ACCT_SUMMARY) {
            return this._emitError('It does not support position cancellation.')
        }
        let version = 1
        let buffer = [OUTGOING.CANCEL_POSITIONS, version]

        return buffer
    }
    cancelRealTimeBars(tickerId) {
        if (this._serverVersion < MIN_SERVER_VER.REAL_TIME_BARS) {
            return this._emitError('It does not support realtime bar data query cancellation.')
        }
        let version = 1
        let buffer = [OUTGOING.CANCEL_REAL_TIME_BARS, version, tickerId]

        return buffer
    }
    cancelScannerSubscription(tickerId) {
        if (this._serverVersion < 24) {
            return this._emitError('It does not support API scanner subscription.')
        }
        let version = 1
        let buffer = [OUTGOING.CANCEL_SCANNER_SUBSCRIPTION, version, tickerId]

        return buffer
    }
    exerciseOptions(tickerId, contract, exerciseAction, exerciseQuantity, account, override) {
        let version = 2
        if (this._serverVersion < 21) {
            return this._emitError('It does not support options exercise from the API.')
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass) || contract.conId > 0) {
                return this._emitError(
                    'It does not support conId and tradingClass parameters in exerciseOptions.'
                )
            }
        }
        let buffer = [OUTGOING.EXERCISE_OPTIONS, version, tickerId]
        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(contract.conId)
        }
        buffer.push(contract.symbol)
        buffer.push(contract.secType)
        buffer.push(contract.expiry)
        buffer.push(contract.strike)
        buffer.push(contract.right)
        buffer.push(contract.multiplier)
        buffer.push(contract.exchange)
        buffer.push(contract.currency)
        buffer.push(contract.localSymbol)
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(contract.tradingClass)
        }
        buffer.push(exerciseAction)
        buffer.push(exerciseQuantity)
        buffer.push(account)
        buffer.push(override)

        return buffer
    }
    placeOrder(id, contract, order) {
        if (this._serverVersion < MIN_SERVER_VER.SCALE_ORDERS) {
            if (
                order.scaleInitLevelSize !== Number.MAX_VALUE ||
                order.scalePriceIncrement !== Number.MAX_VALUE
            ) {
                return this._emitError('It does not support Scale orders.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.SSHORT_COMBO_LEGS) {
            if (Array.isArray(contract.comboLegs)) {
                contract.comboLegs.forEach(
                    function (comboLeg) {
                        if (!isEmpty(comboLeg.shortSaleSlot) || !isEmpty(comboLeg.designatedLocation)) {
                            return this._emitError('It does not support SSHORT flag for combo legs.')
                        }
                    }.bind(this)
                )
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.WHAT_IF_ORDERS) {
            if (order.whatIf) {
                return this._emitError('It does not support what-if orders.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.UNDER_COMP) {
            if (contract.underComp) {
                return this._emitError('It does not support delta-neutral orders.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.SCALE_ORDERS2) {
            if (order.scaleSubsLevelSize !== Number.MAX_VALUE) {
                return this._emitError(
                    'It does not support Subsequent Level Size for Scale orders.'
                )
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.ALGO_ORDERS) {
            if (!isEmpty(order.algoStrategy)) {
                return this._emitError('It does not support algo orders.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.NOT_HELD) {
            if (order.notHeld) {
                return this._emitError('It does not support notHeld parameter.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.SEC_ID_TYPE) {
            if (!isEmpty(contract.secIdType) || !isEmpty(contract.secId)) {
                return this._emitError('It does not support secIdType and secId parameters.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.PLACE_ORDER_CONID) {
            if (contract.conId > 0) {
                return this._emitError('It does not support conId parameter.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.SSHORTX) {
            if (order.exemptCode !== -1) {
                return this._emitError('It does not support exemptCode parameter.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.SSHORTX) {
            if (Array.isArray(contract.comboLegs)) {
                contract.comboLegs.forEach(
                    function (comboLeg) {
                        if (comboLeg.exemptCode !== -1) {
                            return this._emitError('It does not support exemptCode parameter.')
                        }
                    }.bind(this)
                )
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.HEDGE_ORDERS) {
            if (!isEmpty(order.hedgeType)) {
                return this._emitError('It does not support hedge orders.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.OPT_OUT_SMART_ROUTING) {
            if (order.optOutSmartRouting) {
                return this._emitError('It does not support optOutSmartRouting parameter.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.DELTA_NEUTRAL_CONID) {
            if (
                order.deltaNeutralConId > 0 ||
                !isEmpty(order.deltaNeutralSettlingFirm) ||
                !isEmpty(order.deltaNeutralClearingAccount) ||
                !isEmpty(order.deltaNeutralClearingIntent)
            ) {
                return this._emitError(
                    'It does not support deltaNeutral parameters: ConId, SettlingFirm, ClearingAccount, ClearingIntent.'
                )
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.DELTA_NEUTRAL_OPEN_CLOSE) {
            if (
                !isEmpty(order.deltaNeutralOpenClose) ||
                order.deltaNeutralShortSale ||
                order.deltaNeutralShortSaleSlot > 0 ||
                !isEmpty(order.deltaNeutralDesignatedLocation)
            ) {
                return this._emitError(
                    'It does not support deltaNeutral parameters: OpenClose, ShortSale, ShortSaleSlot, DesignatedLocation.'
                )
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.SCALE_ORDERS3) {
            if (order.scalePriceIncrement > 0 && order.scalePriceIncrement !== Number.MAX_VALUE) {
                if (
                    order.scalePriceAdjustValue !== Number.MAX_VALUE ||
                    order.scalePriceAdjustInterval !== Number.MAX_VALUE ||
                    order.scaleProfitOffset !== Number.MAX_VALUE ||
                    order.scaleAutoReset ||
                    order.scaleInitPosition !== Number.MAX_VALUE ||
                    order.scaleInitFillQty !== Number.MAX_VALUE ||
                    order.scaleRandomPercent
                ) {
                    return this._emitError(
                        'It does not support Scale order parameters: PriceAdjustValue, PriceAdjustInterval, ProfitOffset, AutoReset, InitPosition, InitFillQty and RandomPercent'
                    )
                }
            }
        }
        if (
            this._serverVersion < MIN_SERVER_VER.ORDER_COMBO_LEGS_PRICE &&
            typeof contract.secType === 'string' &&
            BAG_SEC_TYPE.toUpperCase() === contract.secType.toUpperCase()
        ) {
            if (Array.isArray(order.orderComboLegs)) {
                order.orderComboLegs.forEach(
                    function (orderComboLeg) {
                        if (orderComboLeg.price !== Number.MAX_VALUE) {
                            return this._emitError(
                                'It does not support per-leg prices for order combo legs.'
                            )
                        }
                    }.bind(this)
                )
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.TRAILING_PERCENT) {
            if (order.trailingPercent !== Number.MAX_VALUE) {
                return this._emitError('It does not support trailing percent parameter.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass)) {
                return this._emitError(
                    'It does not support tradingClass parameters in placeOrder.'
                )
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.SCALE_TABLE) {
            if (
                !isEmpty(order.scaleTable) ||
                !isEmpty(order.activeStartTime) ||
                !isEmpty(order.activeStopTime)
            ) {
                return this._emitError(
                    'It does not support scaleTable, activeStartTime and activeStopTime parameters.'
                )
            }
        }
        let version = this._serverVersion < MIN_SERVER_VER.NOT_HELD ? 27 : 41
        // send place order msg
        let buffer = [OUTGOING.PLACE_ORDER, version, id]
        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.PLACE_ORDER_CONID) {
            buffer.push(contract.conId)
        }
        buffer.push(contract.symbol)
        buffer.push(contract.secType)
        buffer.push(contract.expiry)
        buffer.push(contract.strike)
        buffer.push(contract.right)
        if (this._serverVersion >= 15) {
            buffer.push(contract.multiplier)
        }
        buffer.push(contract.exchange)
        if (this._serverVersion >= 14) {
            buffer.push(contract.primaryExch)
        }
        buffer.push(contract.currency)
        if (this._serverVersion >= 2) {
            buffer.push(contract.localSymbol)
        }
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(contract.tradingClass)
        }
        if (this._serverVersion >= MIN_SERVER_VER.SEC_ID_TYPE) {
            buffer.push(contract.secIdType)
            buffer.push(contract.secId)
        }
        // send main order fields
        buffer.push(order.action)
        buffer.push(order.totalQuantity)
        buffer.push(order.orderType)
        if (this._serverVersion < MIN_SERVER_VER.ORDER_COMBO_LEGS_PRICE) {
            buffer.push(order.lmtPrice === Number.MAX_VALUE ? 0 : order.lmtPrice)
        } else {
            buffer.push(this._nullifyMax(order.lmtPrice))
        }
        if (this._serverVersion < MIN_SERVER_VER.TRAILING_PERCENT) {
            buffer.push(order.auxPrice === Number.MAX_VALUE ? 0 : order.auxPrice)
        } else {
            buffer.push(this._nullifyMax(order.auxPrice))
        }
        // send extended order fields
        buffer.push(order.tif)
        buffer.push(order.ocaGroup)
        buffer.push(order.account)
        buffer.push(order.openClose)
        buffer.push(order.origin)
        buffer.push(order.orderRef)
        buffer.push(order.transmit)
        if (this._serverVersion >= 4) {
            buffer.push(order.parentId)
        }
        if (this._serverVersion >= 5) {
            buffer.push(order.blockOrder)
            buffer.push(order.sweepToFill)
            buffer.push(order.displaySize)
            buffer.push(order.triggerMethod)
            if (this._serverVersion < 38) {
                // will never happen
                buffer.push(/* order.ignoreRth */ false)
            } else {
                buffer.push(order.outsideRth)
            }
        }
        if (this._serverVersion >= 7) {
            buffer.push(order.hidden)
        }
        // Send combo legs for BAG requests
        if (
            this._serverVersion >= 8 &&
            typeof contract.secType === 'string' &&
            BAG_SEC_TYPE.toUpperCase() === contract.secType.toUpperCase()
        ) {
            if (!Array.isArray(contract.comboLegs)) {
                buffer.push(0)
            } else {
                buffer.push(contract.comboLegs.length)
                contract.comboLegs.forEach(
                    function (comboLeg) {
                        buffer.push(comboLeg.conId)
                        buffer.push(comboLeg.ratio)
                        buffer.push(comboLeg.action)
                        buffer.push(comboLeg.exchange)
                        buffer.push(comboLeg.openClose)
                        if (this._serverVersion >= MIN_SERVER_VER.SSHORT_COMBO_LEGS) {
                            buffer.push(comboLeg.shortSaleSlot)
                            buffer.push(comboLeg.designatedLocation)
                        }
                        if (this._serverVersion >= MIN_SERVER_VER.SSHORTX_OLD) {
                            buffer.push(comboLeg.exemptCode)
                        }
                    }.bind(this)
                )
            }
        }
        // Send order combo legs for BAG requests
        if (
            this._serverVersion >= MIN_SERVER_VER.ORDER_COMBO_LEGS_PRICE &&
            typeof contract.secType === 'string' &&
            BAG_SEC_TYPE.toUpperCase() === contract.secType.toUpperCase()
        ) {
            if (!Array.isArray(order.orderComboLegs)) {
                buffer.push(0)
            } else {
                buffer.push(order.orderComboLegs.length)
                order.orderComboLegs.forEach(function (orderComboLeg) {
                    buffer.push(this._nullifyMax(orderComboLeg.price))
                })
            }
        }
        let smartComboRoutingParamsCount
        if (
            this._serverVersion >= MIN_SERVER_VER.SMART_COMBO_ROUTING_PARAMS &&
            typeof contract.secType === 'string' &&
            BAG_SEC_TYPE.toUpperCase() === contract.secType.toUpperCase()
        ) {
            smartComboRoutingParamsCount = !Array.isArray(order.smartComboRoutingParams)
                ? 0
                : order.smartComboRoutingParams.length
            buffer.push(smartComboRoutingParamsCount)
            if (smartComboRoutingParamsCount > 0) {
                order.smartComboRoutingParams.forEach(function (tagValue) {
                    buffer.push(tagValue.tag)
                    buffer.push(tagValue.value)
                })
            }
        }
        if (this._serverVersion >= 9) {
            // send deprecated sharesAllocation field
            buffer.push('')
        }
        if (this._serverVersion >= 10) {
            buffer.push(order.discretionaryAmt)
        }
        if (this._serverVersion >= 11) {
            buffer.push(order.goodAfterTime)
        }
        if (this._serverVersion >= 12) {
            buffer.push(order.goodTillDate)
        }
        if (this._serverVersion >= 13) {
            buffer.push(order.faGroup)
            buffer.push(order.faMethod)
            buffer.push(order.faPercentage)
            buffer.push(order.faProfile)
        }
        if (this._serverVersion >= 18) {
            // institutional short sale slot fields.
            buffer.push(order.shortSaleSlot) // 0 only for retail, 1 or 2 only for institution.
            buffer.push(order.designatedLocation) // only populate when order.shortSaleSlot = 2.
        }
        if (this._serverVersion >= MIN_SERVER_VER.SSHORTX_OLD) {
            buffer.push(order.exemptCode)
        }
        let lower
        let upper
        if (this._serverVersion >= 19) {
            buffer.push(order.ocaType)
            if (this._serverVersion < 38) {
                // will never happen
                buffer.push(/* order.rthOnly */ false)
            }
            buffer.push(order.rule80A)
            buffer.push(order.settlingFirm)
            buffer.push(order.allOrNone)
            buffer.push(this._nullifyMax(order.minQty))
            buffer.push(this._nullifyMax(order.percentOffset))
            buffer.push(order.eTradeOnly)
            buffer.push(order.firmQuoteOnly)
            buffer.push(this._nullifyMax(order.nbboPriceCap))
            buffer.push(this._nullifyMax(order.auctionStrategy))
            buffer.push(this._nullifyMax(order.startingPrice))
            buffer.push(this._nullifyMax(order.stockRefPrice))
            buffer.push(this._nullifyMax(order.delta))
            // Volatility orders had specific watermark price attribs in server version 26
            lower =
                this._serverVersion === 26 && order.orderType === 'VOL'
                    ? Number.MAX_VALUE
                    : order.stockRangeLower
            upper =
                this._serverVersion === 26 && order.orderType === 'VOL'
                    ? Number.MAX_VALUE
                    : order.stockRangeUpper
            buffer.push(this._nullifyMax(lower))
            buffer.push(this._nullifyMax(upper))
        }
        if (this._serverVersion >= 22) {
            buffer.push(order.overridePercentageConstraints)
        }
        if (this._serverVersion >= 26) {
            // Volatility orders
            buffer.push(this._nullifyMax(order.volatility))
            buffer.push(this._nullifyMax(order.volatilityType))
            if (this._serverVersion < 28) {
                buffer.push(order.deltaNeutralOrderType.toUpperCase() === 'MKT')
            } else {
                buffer.push(order.deltaNeutralOrderType)
                buffer.push(this._nullifyMax(order.deltaNeutralAuxPrice))
                if (
                    this._serverVersion >= MIN_SERVER_VER.DELTA_NEUTRAL_CONID &&
                    !isEmpty(order.deltaNeutralOrderType)
                ) {
                    buffer.push(order.deltaNeutralConId)
                    buffer.push(order.deltaNeutralSettlingFirm)
                    buffer.push(order.deltaNeutralClearingAccount)
                    buffer.push(order.deltaNeutralClearingIntent)
                }
                if (
                    this._serverVersion >= MIN_SERVER_VER.DELTA_NEUTRAL_OPEN_CLOSE &&
                    !isEmpty(order.deltaNeutralOrderType)
                ) {
                    buffer.push(order.deltaNeutralOpenClose)
                    buffer.push(order.deltaNeutralShortSale)
                    buffer.push(order.deltaNeutralShortSaleSlot)
                    buffer.push(order.deltaNeutralDesignatedLocation)
                }
            }
            buffer.push(order.continuousUpdate)
            if (this._serverVersion === 26) {
                // Volatility orders had specific watermark price attribs in server version 26
                lower = order.orderType === 'VOL' ? order.stockRangeLower : Number.MAX_VALUE
                upper = order.orderType === 'VOL' ? order.stockRangeUpper : Number.MAX_VALUE
                buffer.push(this._nullifyMax(lower))
                buffer.push(this._nullifyMax(upper))
            }
            buffer.push(this._nullifyMax(order.referencePriceType))
        }
        if (this._serverVersion >= 30) {
            // TRAIL_STOP_LIMIT stop price
            buffer.push(this._nullifyMax(order.trailStopPrice))
        }
        if (this._serverVersion >= MIN_SERVER_VER.TRAILING_PERCENT) {
            buffer.push(this._nullifyMax(order.trailingPercent))
        }
        if (this._serverVersion >= MIN_SERVER_VER.SCALE_ORDERS) {
            if (this._serverVersion >= MIN_SERVER_VER.SCALE_ORDERS2) {
                buffer.push(this._nullifyMax(order.scaleInitLevelSize))
                buffer.push(this._nullifyMax(order.scaleSubsLevelSize))
            } else {
                buffer.push('')
                buffer.push(this._nullifyMax(order.scaleInitLevelSize))
            }
            buffer.push(this._nullifyMax(order.scalePriceIncrement))
        }
        if (
            this._serverVersion >= MIN_SERVER_VER.SCALE_ORDERS3 &&
            order.scalePriceIncrement > 0.0 &&
            order.scalePriceIncrement !== Number.MAX_VALUE
        ) {
            buffer.push(this._nullifyMax(order.scalePriceAdjustValue))
            buffer.push(this._nullifyMax(order.scalePriceAdjustInterval))
            buffer.push(this._nullifyMax(order.scaleProfitOffset))
            buffer.push(order.scaleAutoReset)
            buffer.push(this._nullifyMax(order.scaleInitPosition))
            buffer.push(this._nullifyMax(order.scaleInitFillQty))
            buffer.push(order.scaleRandomPercent)
        }
        if (this._serverVersion >= MIN_SERVER_VER.SCALE_TABLE) {
            buffer.push(order.scaleTable)
            buffer.push(order.activeStartTime)
            buffer.push(order.activeStopTime)
        }
        if (this._serverVersion >= MIN_SERVER_VER.HEDGE_ORDERS) {
            buffer.push(order.hedgeType)
            if (!isEmpty(order.hedgeType)) {
                buffer.push(order.hedgeParam)
            }
        }
        if (this._serverVersion >= MIN_SERVER_VER.OPT_OUT_SMART_ROUTING) {
            buffer.push(order.optOutSmartRouting)
        }
        if (this._serverVersion >= MIN_SERVER_VER.PTA_ORDERS) {
            buffer.push(order.clearingAccount)
            buffer.push(order.clearingIntent)
        }
        if (this._serverVersion >= MIN_SERVER_VER.NOT_HELD) {
            buffer.push(order.notHeld)
        }
        if (this._serverVersion >= MIN_SERVER_VER.UNDER_COMP) {
            if (isPlainObject(contract.underComp) && !isEmpty(contract.underComp)) {
                buffer.push(true)
                buffer.push(contract.underComp.conId)
                buffer.push(contract.underComp.delta)
                buffer.push(contract.underComp.price)
            } else {
                buffer.push(false)
            }
        }
        let algoParamsCount
        if (this._serverVersion >= MIN_SERVER_VER.ALGO_ORDERS) {
            buffer.push(order.algoStrategy)
            if (!isEmpty(order.algoStrategy)) {
                algoParamsCount = !Array.isArray(order.algoParams) ? 0 : order.algoParams.length
                buffer.push(algoParamsCount)
                if (algoParamsCount > 0) {
                    order.algoParams.forEach(function (tagValue) {
                        buffer.push(tagValue.tag)
                        buffer.push(tagValue.value)
                    })
                }
            }
        }
        if (this._serverVersion >= MIN_SERVER_VER.WHAT_IF_ORDERS) {
            buffer.push(order.whatIf)
        }

        return buffer
    }
    replaceFA(faDataType, xml) {
        if (this._serverVersion < 13) {
            return this._emitError('This feature is only available for versions of TWS >= 13.')
        }
        let version = 1
        return [OUTGOING.REPLACE_FA, version, faDataType, xml]
    }
    reqAccountSummary(reqId, group, tags) {
        if (this._serverVersion < MIN_SERVER_VER.ACCT_SUMMARY) {
            return this._emitError('It does not support account summary requests.')
        }
        let version = 1
        return  [OUTGOING.REQ_ACCOUNT_SUMMARY, version, reqId, group, tags]
    }
    reqAccountUpdates(subscribe, acctCode) {
        let version = 2

        if (this._serverVersion >= 9) {
            return [OUTGOING.REQ_ACCOUNT_DATA, version, subscribe, acctCode]
        } else {
            return [OUTGOING.REQ_ACCOUNT_DATA, version, subscribe]
        }
    }
    reqAccountUpdatesMulti(reqId, acctCode, modelCode, ledgerAndNLV) {
        let version = 2
        return [OUTGOING.REQ_ACCOUNT_UPDATES_MULTI,
            version,
            reqId,
            acctCode,
            modelCode,
            ledgerAndNLV]
        
    }
    reqAllOpenOrders() {
        let version = 1
        return [OUTGOING.REQ_ALL_OPEN_ORDERS, version]
    }
    reqAutoOpenOrders(bAutoBind) {
        let version = 1
        return [OUTGOING.REQ_AUTO_OPEN_ORDERS, version, bAutoBind]
    }
    reqHeadTimestamp(reqId, contract, whatToShow, useRTH, formatDate) {
        if (this._serverVersion < MIN_SERVER_VER.REQ_HEAD_TIMESTAMP) {
            // We don't currently support the v100 extended handshake so our server version shows up as < 100.
            // However, this functionality still works so we skip the version check for now.
            // return this._emitError('It does not support reqHeadTimeStamp');
        }
        return [
            OUTGOING.REQ_HEAD_TIMESTAMP,
            reqId,
            contract.conId,
            contract.symbol,
            contract.secType,
            contract.lastTradeDateOrContractMonth,
            contract.strike,
            contract.right,
            contract.multiplier,
            contract.exchange,
            contract.primaryExchange,
            contract.currency,
            contract.localSymbol,
            contract.tradingClass,
            contract.includeExpired,
            useRTH,
            whatToShow,
            formatDate
        ]

    }
    reqContractDetails(reqId, contract) {
        if (this._serverVersion < 4) {
            return this._emitError('This feature is only available for versions of TWS >=4')
        }
        if (this._serverVersion < MIN_SERVER_VER.SEC_ID_TYPE) {
            if (!isEmpty(contract.secIdType) || !isEmpty(contract.secId)) {
                return this._emitError('It does not support secIdType and secId parameters.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass)) {
                return this._emitError(
                    'It does not support tradingClass parameter in reqContractDetails.'
                )
            }
        }
        let version = 7
        // send req mkt data msg
        let buffer = [OUTGOING.REQ_CONTRACT_DATA, version]
        if (this._serverVersion >= MIN_SERVER_VER.CONTRACT_DATA_CHAIN) {
            buffer.push(reqId)
        }
        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.CONTRACT_CONID) {
            buffer.push(contract.conId)
        }
        buffer.push(contract.symbol)
        buffer.push(contract.secType)
        buffer.push(contract.expiry)
        buffer.push(contract.strike)
        buffer.push(contract.right)
        if (this._serverVersion >= 15) {
            buffer.push(contract.multiplier)
        }
        buffer.push(contract.exchange)
        buffer.push(contract.currency)
        buffer.push(contract.localSymbol)
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(contract.tradingClass)
        }
        if (this._serverVersion >= 31) {
            buffer.push(contract.includeExpired)
        }
        if (this._serverVersion >= MIN_SERVER_VER.SEC_ID_TYPE) {
            buffer.push(contract.secIdType)
            buffer.push(contract.secId)
        }

        return buffer
    }
    reqCurrentTime() {
        if (this._serverVersion < 33) {
            return this._emitError('It does not support current time requests.')
        }
        let version = 1
        return [OUTGOING.REQ_CURRENT_TIME, version]
        
    }
    reqExecutions(reqId, filter) {
        // NOTE: Time format must be 'yyyymmdd-hh:mm:ss' E.g. '20030702-14:55'
        let version = 3
        // send req open orders msg
        let buffer = [OUTGOING.REQ_EXECUTIONS, version]
        if (this._serverVersion >= MIN_SERVER_VER.EXECUTION_DATA_CHAIN) {
            buffer.push(reqId)
        }
        // Send the execution rpt filter data (srv v9 and above)
        buffer.push(filter.clientId)
        buffer.push(filter.acctCode)
        buffer.push(filter.time)
        buffer.push(filter.symbol)
        buffer.push(filter.secType)
        buffer.push(filter.exchange)
        buffer.push(filter.side)

        return buffer
    }
    reqFundamentalData(reqId, contract, reportType) {
        if (this._serverVersion < MIN_SERVER_VER.FUNDAMENTAL_DATA) {
            return this._emitError('It does not support fundamental data requests.')
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (contract.conId > 0) {
                return this._emitError(
                    'It does not support conId parameter in reqFundamentalData.'
                )
            }
        }
        let version = 2
        // send req fund data msg
        let buffer = [OUTGOING.REQ_FUNDAMENTAL_DATA, version, reqId]
        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(contract.conId)
        }
        buffer.push(contract.symbol)
        buffer.push(contract.secType)
        buffer.push(contract.exchange)
        buffer.push(contract.primaryExch)
        buffer.push(contract.currency)
        buffer.push(contract.localSymbol)
        buffer.push(reportType)

        return buffer
    }
    reqGlobalCancel() {
        if (this._serverVersion < MIN_SERVER_VER.REQ_GLOBAL_CANCEL) {
            return this._emitError('It does not support globalCancel requests.')
        }
        let version = 1
        return [OUTGOING.REQ_GLOBAL_CANCEL, version]
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
        let version = 6
        if (this._serverVersion < 16) {
            return this._emitError('It does not support historical data backfill.')
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass) || contract.conId > 0) {
                return this._emitError(
                    'It does not support conId and tradingClass parameters in reqHistroricalData.'
                )
            }
        }
        let buffer = [OUTGOING.REQ_HISTORICAL_DATA, version, tickerId]
        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(contract.conId)
        }
        buffer.push(contract.symbol)
        buffer.push(contract.secType)
        buffer.push(contract.expiry)
        buffer.push(contract.strike)
        buffer.push(contract.right)
        buffer.push(contract.multiplier)
        buffer.push(contract.exchange)
        buffer.push(contract.primaryExch)
        buffer.push(contract.currency)
        buffer.push(contract.localSymbol)
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(contract.tradingClass)
        }
        if (this._serverVersion >= 31) {
            buffer.push(!!contract.includeExpired)
        }
        if (this._serverVersion >= 20) {
            buffer.push(endDateTime)
            buffer.push(barSizeSetting)
        }
        buffer.push(durationStr)
        buffer.push(useRTH)
        buffer.push(whatToShow)
        if (this._serverVersion > 16) {
            buffer.push(formatDate)
        }
        if (
            typeof contract.secType === 'string' &&
            BAG_SEC_TYPE.toUpperCase() === contract.secType.toUpperCase()
        ) {
            if (!Array.isArray(contract.comboLegs)) {
                buffer.push(0)
            } else {
                buffer.push(contract.comboLegs.length)
                contract.comboLegs.forEach(function (comboLeg) {
                    buffer.push(comboLeg.conId)
                    buffer.push(comboLeg.ratio)
                    buffer.push(comboLeg.action)
                    buffer.push(comboLeg.exchange)
                })
            }
        }
        if (this._serverVersion >= MIN_SERVER_VER.SYNT_REALTIME_BARS) {
            buffer.push(keepUpToDate)
        }
        if (this._serverVersion >= MIN_SERVER_VER.LINKING) {
            buffer.push('')
        }

        return buffer
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
        if (this._serverVersion < 73) {
            return this._emitError('It does not support historical tick data backfill.')
        }
        let buffer = [OUTGOING.REQ_HISTORICAL_TICKS, tickerId]
        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(contract.conId)
        }
        buffer.push(contract.symbol)
        buffer.push(contract.secType)
        buffer.push(contract.expiry)
        buffer.push(contract.strike)
        buffer.push(contract.right)
        buffer.push(contract.multiplier)
        buffer.push(contract.exchange)
        buffer.push(contract.primaryExch)
        buffer.push(contract.currency)
        buffer.push(contract.localSymbol)
        buffer.push(contract.tradingClass)
        buffer.push(contract.includeExpired)
        buffer.push(startDateTime)
        buffer.push(endDateTime)
        buffer.push(numberOfTicks)
        buffer.push(whatToShow)
        buffer.push(useRTH)
        if (
            typeof contract.secType === 'string' &&
            BAG_SEC_TYPE.toUpperCase() === contract.secType.toUpperCase()
        ) {
            if (!Array.isArray(contract.comboLegs)) {
                buffer.push(0)
            } else {
                buffer.push(contract.comboLegs.length)
                contract.comboLegs.forEach(function (comboLeg) {
                    buffer.push(comboLeg.conId)
                    buffer.push(comboLeg.ratio)
                    buffer.push(comboLeg.action)
                    buffer.push(comboLeg.exchange)
                })
            }
        }
        buffer.push(ignoreSize)
        if (this._serverVersion >= MIN_SERVER_VER.LINKING) {
            buffer.push('')
        }

        return buffer
    }
    reqTickByTickData(tickerId, contract, tickType, numberOfTicks, ignoreSize) {
        if (this._serverVersion < 73) {
            return this._emitError('It does not support tick by tick data.')
        }
        let buffer = [OUTGOING.REQ_TICK_BY_TICK_DATA, tickerId]
        // send contract fields
        buffer.push(contract.conId)
        buffer.push(contract.symbol)
        buffer.push(contract.secType)
        buffer.push(contract.expiry)
        buffer.push(contract.strike)
        buffer.push(contract.right)
        buffer.push(contract.multiplier)
        buffer.push(contract.exchange)
        buffer.push(contract.primaryExch)
        buffer.push(contract.currency)
        buffer.push(contract.localSymbol)
        buffer.push(contract.tradingClass)
        buffer.push(tickType)
        buffer.push(numberOfTicks)
        buffer.push(ignoreSize)

        return buffer
    }
    cancelTickByTickData(tickerId) {
        if (this._serverVersion < 73) {
            return this._emitError('It does not support tick by tick data.')
        }
        return [OUTGOING.CANCEL_TICK_BY_TICK_DATA, tickerId]
    }
    reqIds(numIds) {
        let version = 1
        return [OUTGOING.REQ_IDS, version, numIds]
    }
    reqManagedAccts() {
        let version = 1
        return [OUTGOING.REQ_MANAGED_ACCTS, version]
    }
    reqMarketDataType(marketDataType) {
        if (this._serverVersion < MIN_SERVER_VER.REQ_MARKET_DATA_TYPE) {
            return this._emitError('It does not support marketDataType requests.')
        }
        let version = 1
        return [OUTGOING.REQ_MARKET_DATA_TYPE, version, marketDataType]
    }
    reqMktData(tickerId, contract, genericTickList, snapshot, regulatorySnapshot) {
        if (this._serverVersion < MIN_SERVER_VER.SNAPSHOT_MKT_DATA && snapshot) {
            return this._emitError('It does not support snapshot market data requests.')
        }
        if (this._serverVersion < MIN_SERVER_VER.UNDER_COMP) {
            return this._emitError('It does not support delta-neutral orders.')
        }
        if (this._serverVersion < MIN_SERVER_VER.REQ_MKT_DATA_CONID) {
            return this._emitError('It does not support conId parameter.')
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass)) {
                return this._emitError(
                    'It does not support tradingClass parameter in reqMarketData.'
                )
            }
        }
        let version = 11
        let buffer = [OUTGOING.REQ_MKT_DATA, version, tickerId]
        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.REQ_MKT_DATA_CONID) {
            buffer.push(contract.conId)
        }
        buffer.push(contract.symbol)
        buffer.push(contract.secType)
        buffer.push(contract.expiry)
        buffer.push(contract.strike)
        buffer.push(contract.right)
        if (this._serverVersion >= 15) {
            buffer.push(contract.multiplier)
        }
        buffer.push(contract.exchange)
        if (this._serverVersion >= 14) {
            buffer.push(contract.primaryExch)
        }
        buffer.push(contract.currency)
        if (this._serverVersion >= 2) {
            buffer.push(contract.localSymbol)
        }
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(contract.tradingClass)
        }
        if (
            this._serverVersion >= 8 &&
            typeof contract.secType === 'string' &&
            BAG_SEC_TYPE.toUpperCase() === contract.secType.toUpperCase()
        ) {
            if (!Array.isArray(contract.comboLegs)) {
                buffer.push(0)
            } else {
                buffer.push(contract.comboLegs.length)
                contract.comboLegs.forEach(function (comboLeg) {
                    buffer.push(comboLeg.conId)
                    buffer.push(comboLeg.ratio)
                    buffer.push(comboLeg.action)
                    buffer.push(comboLeg.exchange)
                })
            }
        }
        if (this._serverVersion >= MIN_SERVER_VER.UNDER_COMP) {
            if (isPlainObject(contract.underComp)) {
                buffer.push(true)
                buffer.push(contract.underComp.conId)
                buffer.push(contract.underComp.delta)
                buffer.push(contract.underComp.price)
            } else {
                buffer.push(false)
            }
        }
        if (this._serverVersion >= 31) {
            /*
             * Note: Even though SHORTABLE tick type supported only
             *       starting server version 33 it would be relatively
             *       expensive to expose this restriction here.
             *
             *       Therefore we are relying on TWS doing validation.
             */
            buffer.push(genericTickList)
        }
        if (this._serverVersion >= MIN_SERVER_VER.SNAPSHOT_MKT_DATA) {
            buffer.push(snapshot)
        }
        if (this._serverVersion >= MIN_SERVER_VER.REQ_SMART_COMPONENTS) {
            buffer.push(regulatorySnapshot)
        }
        if (this._serverVersion >= MIN_SERVER_VER.LINKING) {
            buffer.push('')
        }

        return buffer
    }
    reqMktDepth(tickerId, contract, numRows) {
        if (this._serverVersion < 6) {
            return this._emitError('This feature is only available for versions of TWS >=6')
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass) || contract.conId > 0) {
                return this._emitError(
                    'It does not support conId and tradingClass parameters in reqMktDepth.'
                )
            }
        }
        let version = 4
        // send req mkt data msg
        let buffer = [OUTGOING.REQ_MKT_DEPTH, version, tickerId]
        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(contract.conId)
        }
        buffer.push(contract.symbol)
        buffer.push(contract.secType)
        buffer.push(contract.expiry)
        buffer.push(contract.strike)
        buffer.push(contract.right)
        if (this._serverVersion >= 15) {
            buffer.push(contract.multiplier)
        }
        buffer.push(contract.exchange)
        buffer.push(contract.currency)
        buffer.push(contract.localSymbol)
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(contract.tradingClass)
        }
        if (this._serverVersion >= 19) {
            buffer.push(numRows)
        }

        return buffer
    }
    reqNewsBulletins(allMsgs) {
        let version = 1
        return [OUTGOING.REQ_NEWS_BULLETINS, version, allMsgs]
    }
    reqOpenOrders() {
        let version = 1
        return [OUTGOING.REQ_OPEN_ORDERS, version]
    }
    reqPositions() {
        if (this._serverVersion < MIN_SERVER_VER.ACCT_SUMMARY) {
            return this._emitError('It does not support position requests.')
        }
        let version = 1
        return [OUTGOING.REQ_POSITIONS, version]
    }
    reqPositionsMulti(reqId, account, modelCode) {
        if (this._serverVersion < MIN_SERVER_VER.ACCT_SUMMARY) {
            return this._emitError('It does not support position requests.')
        }
        let version = 1
        return [OUTGOING.REQ_POSITIONS_MULTI, version, reqId, account, modelCode]
    }
    reqRealTimeBars(tickerId, contract, barSize, whatToShow, useRTH) {
        if (this._serverVersion < MIN_SERVER_VER.REAL_TIME_BARS) {
            return this._emitError('It does not support real time bars.')
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass) || contract.conId > 0) {
                return this._emitError(
                    'It does not support conId and tradingClass parameters in reqRealTimeBars.'
                )
            }
        }
        let version = 2
        // send req mkt data msg
        let buffer = [OUTGOING.REQ_REAL_TIME_BARS, version, tickerId]
        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(contract.conId)
        }
        buffer.push(contract.symbol)
        buffer.push(contract.secType)
        buffer.push(contract.expiry)
        buffer.push(contract.strike)
        buffer.push(contract.right)
        buffer.push(contract.multiplier)
        buffer.push(contract.exchange)
        buffer.push(contract.primaryExch)
        buffer.push(contract.currency)
        buffer.push(contract.localSymbol)
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(contract.tradingClass)
        }
        buffer.push(barSize) // this parameter is not currently used
        buffer.push(whatToShow)
        buffer.push(useRTH)

        return buffer
    }
    reqScannerParameters() {
        if (this._serverVersion < 24) {
            return this._emitError('It does not support API scanner subscription.')
        }
        let version = 1
        return [OUTGOING.REQ_SCANNER_PARAMETERS, version]
    }
    reqScannerSubscription(tickerId, subscription) {
        if (this._serverVersion < 24) {
            return this._emitError('It does not support API scanner subscription.')
        }
        let version = 3
        let buffer = [OUTGOING.REQ_SCANNER_SUBSCRIPTION, version, tickerId]
        buffer.push(this._nullifyMax(subscription.numberOfRows))
        buffer.push(subscription.instrument)
        buffer.push(subscription.locationCode)
        buffer.push(subscription.scanCode)
        buffer.push(this._nullifyMax(subscription.abovePrice))
        buffer.push(this._nullifyMax(subscription.belowPrice))
        buffer.push(this._nullifyMax(subscription.aboveVolume))
        buffer.push(this._nullifyMax(subscription.marketCapAbove))
        buffer.push(this._nullifyMax(subscription.marketCapBelow))
        buffer.push(subscription.moodyRatingAbove)
        buffer.push(subscription.moodyRatingBelow)
        buffer.push(subscription.spRatingAbove)
        buffer.push(subscription.spRatingBelow)
        buffer.push(subscription.maturityDateAbove)
        buffer.push(subscription.maturityDateBelow)
        buffer.push(this._nullifyMax(subscription.couponRateAbove))
        buffer.push(this._nullifyMax(subscription.couponRateBelow))
        buffer.push(subscription.excludeConvertible)
        if (this._serverVersion >= 25) {
            buffer.push(this._nullifyMax(subscription.averageOptionVolumeAbove))
            buffer.push(subscription.scannerSettingPairs)
        }
        if (this._serverVersion >= 27) {
            buffer.push(subscription.stockTypeFilter)
        }

        return buffer
    }
    requestFA(faDataType) {
        if (this._serverVersion < 13) {
            return this._emitError('This feature is only available for versions of TWS >= 13.')
        }
        let version = 1
        return [OUTGOING.REQ_FA, version, faDataType]
    }
    setServerLogLevel(logLevel) {
        let version = 1
        return [OUTGOING.SET_SERVER_LOGLEVEL, version, logLevel]
    }
    queryDisplayGroups(reqId) {
        return [OUTGOING.QUERY_DISPLAY_GROUPS, 1, reqId]
    }
    updateDisplayGroup(reqId, contractInfo) {
        return [OUTGOING.UPDATE_DISPLAY_GROUP, 1, reqId, contractInfo]
    }
    subscribeToGroupEvents(reqId, groupId) {
        return [OUTGOING.SUBSCRIBE_TO_GROUP_EVENTS, 1, reqId, groupId]
    }
    unsubscribeToGroupEvents(reqId) {
        return [OUTGOING.UNSUBSCRIBE_FROM_GROUP_EVENTS, 1, reqId]
    }
    reqSecDefOptParams(reqId, underlyingSymbol, futFopExchange, underlyingSecType, underlyingConId) {
        if (this._serverVersion < MIN_SERVER_VER.SEC_DEF_OPT_PARAMS_REQ) {
            return this._emitError('It does not support reqSecDefOptParams.')
        }
        return [
            OUTGOING.REQ_SEC_DEF_OPT_PARAMS,
            reqId,
            underlyingSymbol,
            futFopExchange,
            underlyingSecType,
            underlyingConId
        ]
    }
}
export default MessageEncoder
