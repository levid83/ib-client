import { isEmpty, isPlainObject, flattenDeep } from 'lodash'

import { MIN_SERVER_VER, SERVER_VERSION, OUTGOING, SEC_TYPE, ORDER_TYPE } from './constants'
import {  MIN_VERSION, MAX_VERSION , EOL } from './constants'

import { BrokerError, BROKER_ERRORS} from './errors' 

class MessageEncoder {
    constructor(options = { eventHandler: null} ){
        this._eventHandler= options.eventHandler
        this._serverVersion = SERVER_VERSION    
    }

    _emitError(id, error, message){
        if (typeof error ==='string'){
            this._eventHandler.emit('error', new BrokerError({ id:id, code:null, message: error+' '+message}))
        }else{
            this._eventHandler.emit('error', new BrokerError({ id:id , code :error.code, message:error.message+' '+message}))
        }
    }
   
    _encodeLengthHeader(value) {
        let arr = []
        let mask = 0xff

        arr.push(mask & (value >> 24))
        arr.push(mask & (value >> 16))
        arr.push(mask & (value >> 8))
        arr.push(mask & value)
        return arr
    }

    _encodeString(value) {
        if (value != null) {
            return Array.from(value.concat(EOL), c => c.charCodeAt())
        } else {
            return 0
        }
    }

    _encodeBool(value){
        return this._encodeString((value ? 1 : 0).toString())
    }
    _encodeMax(value) {
        return (value === 0xffffffff || value === Number.MAX_VALUE
            ? this._encode('')
            : this._encode(value))
    }

    _encode(value) {
        if (typeof value === "boolean") return this._encodeBool(value)
        return this._encodeString(value === undefined || value === null ? null : value.toString())
    }

    encodeMessage(data){
        let error = data[0]
        let func = data[1]
        let args = data.slice(2)
        if (typeof this[func] !== 'function')
            throw new Error('Unknown broker API request  - ' + func)
        let tokens = flattenDeep(this[func](...args))
        return { error, func, args, message: this._prependV100LengthHeader(tokens)}
    }

    setServerVersion(version){
        this._serverVersion= version
    }

    _prependV100LengthHeader(message) {
        let header = this._getV100LengthHeader(message.length)
        return header.concat(message)
    }

    _getV100LengthHeader(length) {
        return this._encodeLengthHeader(length)
    }

    sendV100APIHeader() {
        let prefix = this._encode('API')
        let version = this._encode('v' + (MIN_VERSION < MAX_VERSION ? MIN_VERSION + '..' + MAX_VERSION : MIN_VERSION))
        version.splice(-1)
        return [prefix, this._getV100LengthHeader(version.length), version]
    }

    startAPI(clientId, optionalCapabilities){
        let version = 2
        let buffer = [this._encode(OUTGOING.START_API), this._encode(version), this._encode(clientId)]
        if (this._serverVersion >= MIN_SERVER_VER.OPTIONAL_CAPABILITIES) {
            buffer.push(this._encode(optionalCapabilities))
        }
        return buffer
    }
    cancelScannerSubscription(tickerId) {
        if (this._serverVersion < 24) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support API scanner subscription.')
        }
        let version = 1
        let buffer = [this._encode(OUTGOING.CANCEL_SCANNER_SUBSCRIPTION), this._encode(version), this._encode(tickerId)]

        return buffer
    }

    reqScannerParameters() {
        if (this._serverVersion < 24) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS,'It does not support API scanner subscription.')
        }
        let version = 1
        return [this._encode(OUTGOING.REQ_SCANNER_PARAMETERS), this._encode(version)]
    }
    
    reqScannerSubscription(tickerId, subscription, scannerSubscriptionOptions, scannerSubscriptionFilterOptions) {
        if (this._serverVersion < 24) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support API scanner subscription.')
        }
        if (this._serverVersion < MIN_SERVER_VER.SCANNER_GENERIC_OPTS && scannerSubscriptionFilterOptions != null) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,"It does not support API scanner subscription generic filter options")

        }
        let version = 4
        let buffer = [this._encode(OUTGOING.REQ_SCANNER_SUBSCRIPTION)]
        if (this._serverVersion < MIN_SERVER_VER.SCANNER_GENERIC_OPTS) {
            buffer.push(this._encode(version))
        }

        buffer.push(this._encode(tickerId))
        buffer.push(this._encodeMax(subscription.numberOfRows))
        buffer.push(this._encode(subscription.instrument))
        buffer.push(this._encode(subscription.locationCode))
        buffer.push(this._encode(subscription.scanCode))
        buffer.push(this._encodeMax(subscription.abovePrice))
        buffer.push(this._encodeMax(subscription.belowPrice))
        buffer.push(this._encodeMax(subscription.aboveVolume))
        buffer.push(this._encodeMax(subscription.marketCapAbove))
        buffer.push(this._encodeMax(subscription.marketCapBelow))
        buffer.push(this._encode(subscription.moodyRatingAbove))
        buffer.push(this._encode(subscription.moodyRatingBelow))
        buffer.push(this._encode(subscription.spRatingAbove))
        buffer.push(this._encode(subscription.spRatingBelow))
        buffer.push(this._encode(subscription.maturityDateAbove))
        buffer.push(this._encode(subscription.maturityDateBelow))
        buffer.push(this._encodeMax(subscription.couponRateAbove))
        buffer.push(this._encodeMax(subscription.couponRateBelow))
        buffer.push(this._encode(subscription.excludeConvertible))
        if (this._serverVersion >= 25) {
            buffer.push(this._encodeMax(subscription.averageOptionVolumeAbove))
            buffer.push(this._encode(subscription.scannerSettingPairs))
        }
        if (this._serverVersion >= 27) {
            buffer.push(this._encode(subscription.stockTypeFilter))
        }

        if (this._serverVersion >= MIN_SERVER_VER.SCANNER_GENERIC_OPTS) {
            buffer.push(this._encode(scannerSubscriptionFilterOptions))
        }

        // send scannerSubscriptionOptions parameter
        if (this._serverVersion >= MIN_SERVER_VER.LINKING) {
            buffer.push(this._encode(scannerSubscriptionOptions))
        }

        return buffer
    }
    
    reqMktData(tickerId, contract, genericTickList, snapshot, regulatorySnapshot, mktDataOptions) {

        if (this._serverVersion < MIN_SERVER_VER.SNAPSHOT_MKT_DATA && snapshot) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support snapshot market data requests.')
        }
        if (this._serverVersion < MIN_SERVER_VER.DELTA_NEUTRAL) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support delta-neutral orders.')
        }
        if (this._serverVersion < MIN_SERVER_VER.REQ_MKT_DATA_CONID) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support conId parameter.')
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass)) {
                return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,
                    'It does not support tradingClass parameter in reqMarketData.'
                )
            }
        }
        let version = 11
        let buffer = [this._encode(OUTGOING.REQ_MKT_DATA), this._encode(version), this._encode(tickerId)]
        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.REQ_MKT_DATA_CONID) {
            buffer.push(this._encode(contract.conId))
        }
        buffer.push(this._encode(contract.symbol))
        buffer.push(this._encode(contract.secType))
        buffer.push(this._encode(contract.expiry))
        buffer.push(this._encode(contract.strike))
        buffer.push(this._encode(contract.right))

        if (this._serverVersion >= 15) {
            buffer.push(this._encode(contract.multiplier))
        }

        buffer.push(this._encode(contract.exchange))
        
        if (this._serverVersion >= 14) {
            buffer.push(this._encode(contract.primaryExch))
        }
        buffer.push(this._encode(contract.currency))
        if (this._serverVersion >= 2) {
            buffer.push(this._encode(contract.localSymbol))
        }
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(this._encode(contract.tradingClass))
        }
        if (
            this._serverVersion >= 8 &&
            typeof contract.secType === 'string' &&
            SEC_TYPE.BAG.toUpperCase() === contract.secType.toUpperCase()
        ) {
            if (!Array.isArray(contract.comboLegs)) {
                buffer.push(this._encode(0))
            } else {
                buffer.push(this._encode(contract.comboLegs.length))
                contract.comboLegs.forEach(comboLeg =>{
                    buffer.push(this._encode(comboLeg.conId))
                    buffer.push(this._encode(comboLeg.ratio))
                    buffer.push(this._encode(comboLeg.action))
                    buffer.push(this._encode(comboLeg.exchange))
                })
            }
        }
        if (this._serverVersion >= MIN_SERVER_VER.DELTA_NEUTRAL) {
            if (isPlainObject(contract.deltaNeutralContract)) {
                buffer.push(this._encode(true))
                buffer.push(this._encode(contract.deltaNeutralContract.conId))
                buffer.push(this._encode(contract.deltaNeutralContract.delta))
                buffer.push(this._encode(contract.deltaNeutralContract.price))
            } else {
                buffer.push(this._encode(false))
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
            buffer.push(this._encode(genericTickList))
        }
        if (this._serverVersion >= MIN_SERVER_VER.SNAPSHOT_MKT_DATA) {
            buffer.push(this._encode(snapshot))
        }
        if (this._serverVersion >= MIN_SERVER_VER.REQ_SMART_COMPONENTS) {
            buffer.push(this._encode(regulatorySnapshot))
        }
        if (this._serverVersion >= MIN_SERVER_VER.LINKING) {
            buffer.push(this._encode(mktDataOptions))
        }

        return buffer
    }

    cancelHistoricalData(tickerId) {
        if (this._serverVersion < 24) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support historical data query cancellation.')
        }
        let version = 1
        let buffer = [this._encode(OUTGOING.CANCEL_HISTORICAL_DATA), this._encode(version), this._encode(tickerId)]

        return buffer
    }

    cancelRealTimeBars(tickerId) {
        if (this._serverVersion < MIN_SERVER_VER.REAL_TIME_BARS) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support realtime bar data query cancellation.')
        }
        let version = 1
        let buffer = [this._encode(OUTGOING.CANCEL_REAL_TIME_BARS), this._encode(version), this._encode(tickerId)]

        return buffer
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
        let version = 6
        if (this._serverVersion < 16) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support historical data backfill.')
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass) || contract.conId > 0) {
                return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,
                    'It does not support conId and tradingClass parameters in reqHistroricalData.'
                )
            }
        }
        let buffer = [this._encode(OUTGOING.REQ_HISTORICAL_DATA)]

        if (this._serverVersion >= MIN_SERVER_VER.SYNT_REALTIME_BARS) {
            buffer.push(this._encode(version))
        }
    
        buffer.push(this._encode(tickerId))

        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(this._encode(contract.conId))
        }
        buffer.push(this._encode(contract.symbol))
        buffer.push(this._encode(contract.secType))
        buffer.push(this._encode(contract.expiry))
        buffer.push(this._encode(contract.strike))
        buffer.push(this._encode(contract.right))
        buffer.push(this._encode(contract.multiplier))
        buffer.push(this._encode(contract.exchange))
        buffer.push(this._encode(contract.primaryExch))
        buffer.push(this._encode(contract.currency))
        buffer.push(this._encode(contract.localSymbol))
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(this._encode(contract.tradingClass))
        }
        if (this._serverVersion >= 31) {
            buffer.push(this._encode(contract.includeExpired ? 1 : 0))
        }
        if (this._serverVersion >= 20) {
            buffer.push(this._encode(endDateTime))
            buffer.push(this._encode(barSizeSetting))
        }
        buffer.push(this._encode(durationStr))
        buffer.push(this._encode(useRTH))
        buffer.push(this._encode(whatToShow))

        if (this._serverVersion > 16) {
            buffer.push(this._encode(formatDate))
        }
        if (
            typeof contract.secType === 'string' &&
            SEC_TYPE.BAG.toUpperCase() === contract.secType.toUpperCase()
        ) {
            if (!Array.isArray(contract.comboLegs)) {
                buffer.push(this._encode(0))
            } else {
                buffer.push(this._encode(contract.comboLegs.length))
                contract.comboLegs.forEach(comboLeg=>{
                    buffer.push(this._encode(comboLeg.conId))
                    buffer.push(this._encode(comboLeg.ratio))
                    buffer.push(this._encode(comboLeg.action))
                    buffer.push(this._encode(comboLeg.exchange))
                })
            }
        }
        if (this._serverVersion >= MIN_SERVER_VER.SYNT_REALTIME_BARS) {
            buffer.push(this._encode(keepUpToDate))
        }
         // send chartOptions parameter
        if (this._serverVersion >= MIN_SERVER_VER.LINKING) {
            buffer.push(this._encode(chartOptions))
        }

        return buffer
    }

    reqHeadTimestamp(reqId, contract, whatToShow, useRTH, formatDate) {
        if (this._serverVersion < MIN_SERVER_VER.REQ_HEAD_TIMESTAMP) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support reqHeadTimeStamp')
        }
        return [  
            this._encode(OUTGOING.REQ_HEAD_TIMESTAMP),
            this._encode(reqId),
            this._encode(contract.conId),
            this._encode(contract.symbol),
            this._encode(contract.secType),
            this._encode( contract.expiry),
            this._encode( contract.strike),
            this._encode( contract.right),
            this._encode( contract.multiplier),
            this._encode( contract.exchange),
            this._encode(  contract.primaryExchange),
            this._encode( contract.currency),
            this._encode( contract.localSymbol),
            this._encode( contract.tradingClass),
            this._encode( contract.includeExpired),
            this._encode( useRTH),
            this._encode(whatToShow),
            this._encode( formatDate)
        ]

    }

    cancelHeadTimestamp(reqId) {
        if (this._serverVersion < MIN_SERVER_VER.CANCEL_HEADTIMESTAMP) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support head time stamp requests canceling.')
        }
        return [
            this._encode(OUTGOING.CANCEL_HEAD_TIMESTAMP),
                this._encode(reqId) 
        ]

    }

    reqRealTimeBars(tickerId, contract, barSize, whatToShow, useRTH, realTimeBarsOptions) {
        if (this._serverVersion < MIN_SERVER_VER.REAL_TIME_BARS) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support real time bars.')
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass) || contract.conId > 0) {
                return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,
                    'It does not support conId and tradingClass parameters in reqRealTimeBars.'
                )
            }
        }
        let version = 3
        // send req mkt data msg
        let buffer = [this._encode(OUTGOING.REQ_REAL_TIME_BARS), this._encode(version), this._encode(tickerId)]
        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(this._encode(contract.conId))
        }
        buffer.push(this._encode(contract.symbol))
        buffer.push(this._encode(contract.secType))
        buffer.push(this._encode(contract.expiry))
        buffer.push(this._encode(contract.strike))
        buffer.push(this._encode(contract.right))
        buffer.push(this._encode(contract.multiplier))
        buffer.push(this._encode(contract.exchange))
        buffer.push(this._encode(contract.primaryExch))
        buffer.push(this._encode(contract.currency))
        buffer.push(this._encode(contract.localSymbol))
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(this._encode(contract.tradingClass))
        }
        buffer.push(this._encode(barSize)) // this parameter is not currently used
        buffer.push(this._encode(whatToShow))
        buffer.push(this._encode(useRTH))

        // send realTimeBarsOptions parameter
        if (this._serverVersion >= MIN_SERVER_VER.LINKING) {
            buffer.push(this._encode(realTimeBarsOptions))
        }

        return buffer
    }

    reqContractDetails(reqId, contract) {
        if (this._serverVersion < 4) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'This feature is only available for versions of TWS >=4')
        }
        if (this._serverVersion < MIN_SERVER_VER.SEC_ID_TYPE) {
            if (!isEmpty(contract.secIdType) || !isEmpty(contract.secId)) {
                return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support secIdType and secId parameters.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass)) {
                return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,
                    'It does not support tradingClass parameter in reqContractDetails.'
                )
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.LINKING) {
            if (!isEmpty(contract.primaryExch)) {
                return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support primaryExchange parameter in reqContractDetails.')
            }
        }
        let version =8
        // send req mkt data msg
        let buffer = [this._encode(OUTGOING.REQ_CONTRACT_DATA), this._encode(version)]
        if (this._serverVersion >= MIN_SERVER_VER.CONTRACT_DATA_CHAIN) {
            buffer.push(this._encode(reqId))
        }
        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.CONTRACT_CONID) {
            buffer.push(this._encode(contract.conId))
        }
        buffer.push(this._encode(contract.symbol))
        buffer.push(this._encode(contract.secType))
        buffer.push(this._encode(contract.expiry))
        buffer.push(this._encode(contract.strike))
        buffer.push(this._encode(contract.right))
        if (this._serverVersion >= 15) {
            buffer.push(this._encode(contract.multiplier))
        }
        buffer.push(this._encode(contract.exchange))


        if (this._serverVersion >= MIN_SERVER_VER.PRIMARYEXCH) {
            buffer.push(this._encode(contract.exchange))
            buffer.push(this._encode(contract.primaryExch))
        } else if (this._serverVersion >= MIN_SERVER_VER.LINKING) {
            if (!isEmpty(contract.primaryExch)
                && ("BEST" === contract.exchange  || "SMART"=== contract.exchange)) {
                buffer.push(this._encode(contract.exchange + ":" + contract.primaryExch))
            } else {
                buffer.push(this._encode(contract.exchange))
            }
        }

        buffer.push(this._encode(contract.currency))
        buffer.push(this._encode(contract.localSymbol))

        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(this._encode(contract.tradingClass))
        }
        if (this._serverVersion >= 31) {
            buffer.push(this._encode(contract.includeExpired))
        }
        if (this._serverVersion >= MIN_SERVER_VER.SEC_ID_TYPE) {
            buffer.push(this._encode(contract.secIdType))
            buffer.push(this._encode(contract.secId))
        }

        return buffer
    }

    reqMktDepth(tickerId, contract, numRows, isSmartDepth, mktDepthOptions) {
        if (this._serverVersion < 6) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'This feature is only available for versions of TWS >=6')
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass) || contract.conId > 0) {
                return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,
                    'It does not support conId and tradingClass parameters in reqMktDepth.'
                )
            }
        }

        if (this._serverVersion < MIN_SERVER_VER.SMART_DEPTH && isSmartDepth) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support SMART depth request.')
        }

        let version = 5

        // send req mkt data msg
        let buffer = [this._encode(OUTGOING.REQ_MKT_DEPTH), this._encode(version), this._encode(tickerId)]
        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(this._encode(contract.conId))
        }
        buffer.push(this._encode(contract.symbol))
        buffer.push(this._encode(contract.secType))
        buffer.push(this._encode(contract.expiry))
        buffer.push(this._encode(contract.strike))
        buffer.push(this._encode(contract.right))
        if (this._serverVersion >= 15) {
            buffer.push(this._encode(contract.multiplier))
        }
        buffer.push(this._encode(contract.exchange))
        buffer.push(this._encode(contract.currency))
        buffer.push(this._encode(contract.localSymbol))
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(this._encode(contract.tradingClass))
        }
        if (this._serverVersion >= 19) {
            buffer.push(this._encode(numRows))
        }

        if (this._serverVersion >= MIN_SERVER_VER.SMART_DEPTH) {
            buffer.push(this._encode(isSmartDepth))
        }

        if (this._serverVersion >= MIN_SERVER_VER.LINKING) {
            buffer.push(this._encode(mktDepthOptions))
        }
        
        return buffer
    }

    cancelMktData(tickerId) {
        let version = 1
        let buffer = [this._encode(OUTGOING.CANCEL_MKT_DATA), this._encode(version), this._encode(tickerId)]

        return buffer
    }

    cancelMktDepth(tickerId, isSmartDepth) {
        if (this._serverVersion < 6) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'This feature is only available for versions of TWS >=6.')
        }

        if (this._serverVersion >= MIN_SERVER_VER.SMART_DEPTH && isSmartDepth ) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support SMART depth cancel.')
        }

        let version = 1
        let buffer = [this._encode(OUTGOING.CANCEL_MKT_DEPTH), this._encode(version), this._encode(tickerId)]

        if (this._serverVersion >= MIN_SERVER_VER.SMART_DEPTH) {
            buffer.push(this._encode(isSmartDepth))
        }

        return buffer
    }

    exerciseOptions(tickerId, contract, exerciseAction, exerciseQuantity, account, override) {
        let version = 2
        if (this._serverVersion < 21) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support options exercise from the API.')
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass) || contract.conId > 0) {
                return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,
                    'It does not support conId and tradingClass parameters in exerciseOptions.'
                )
            }
        }
        let buffer = [this._encode(OUTGOING.EXERCISE_OPTIONS), this._encode(version), this._encode(tickerId)]
        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(this._encode(contract.conId))
        }
        buffer.push(this._encode(contract.symbol))
        buffer.push(this._encode(contract.secType))
        buffer.push(this._encode(contract.expiry))
        buffer.push(this._encode(contract.strike))
        buffer.push(this._encode(contract.right))
        buffer.push(this._encode(contract.multiplier))
        buffer.push(this._encode(contract.exchange))
        buffer.push(this._encode(contract.currency))
        buffer.push(this._encode(contract.localSymbol))
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(this._encode(contract.tradingClass))
        }
        buffer.push(this._encode(exerciseAction))
        buffer.push(this._encode(exerciseQuantity))
        buffer.push(this._encode(account))
        buffer.push(this._encode(override))

        return buffer
    }

    placeOrder(id, contract, order) {
        if (this._serverVersion < MIN_SERVER_VER.SCALE_ORDERS) {
            if (
                order.scaleInitLevelSize !== Number.MAX_VALUE ||
                order.scalePriceIncrement !== Number.MAX_VALUE
            ) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,'It does not support Scale orders.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.SSHORT_COMBO_LEGS) {
            if (Array.isArray(contract.comboLegs)) {
                contract.comboLegs.forEach(
                    function (comboLeg) {
                        if (!isEmpty(comboLeg.shortSaleSlot) || !isEmpty(comboLeg.designatedLocation)) {
                            return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,'It does not support SSHORT flag for combo legs.')
                        }
                    }.bind(this)
                )
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.WHAT_IF_ORDERS) {
            if (order.whatIf) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,'It does not support what-if orders.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.DELTA_NEUTRAL) {
            if (contract.deltaNeutralContract) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,'It does not support delta-neutral orders.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.SCALE_ORDERS2) {
            if (order.scaleSubsLevelSize && order.scaleSubsLevelSize !== Number.MAX_VALUE) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
                    'It does not support Subsequent Level Size for Scale orders.'
                )
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.ALGO_ORDERS) {
            if (!isEmpty(order.algoStrategy)) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,'It does not support algo orders.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.NOT_HELD) {
            if (order.notHeld) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,'It does not support notHeld parameter.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.SEC_ID_TYPE) {
            if (!isEmpty(contract.secIdType) || !isEmpty(contract.secId)) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,'It does not support secIdType and secId parameters.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.PLACE_ORDER_CONID) {
            if (contract.conId > 0) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,'It does not support conId parameter.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.SSHORTX) {
            if (order.exemptCode && order.exemptCode !== -1) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,'It does not support exemptCode parameter.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.SSHORTX) {
            if (Array.isArray(contract.comboLegs)) {
                contract.comboLegs.forEach(
                    comboLeg=> 
                        comboLeg.exemptCode !== -1 && this._emitError('It does not support exemptCode parameter.')
                )
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.HEDGE_ORDERS) {
            if (!isEmpty(order.hedgeType)) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,'It does not support hedge orders.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.OPT_OUT_SMART_ROUTING) {
            if (order.optOutSmartRouting) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,'It does not support optOutSmartRouting parameter.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.DELTA_NEUTRAL_CONID) {
            if (
                order.deltaNeutralConId > 0 ||
                !isEmpty(order.deltaNeutralSettlingFirm) ||
                !isEmpty(order.deltaNeutralClearingAccount) ||
                !isEmpty(order.deltaNeutralClearingIntent)
            ) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
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
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
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
                    return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
                        'It does not support Scale order parameters: PriceAdjustValue, PriceAdjustInterval, ProfitOffset, AutoReset, InitPosition, InitFillQty and RandomPercent'
                    )
                }
            }
        }
        if (
            this._serverVersion < MIN_SERVER_VER.ORDER_COMBO_LEGS_PRICE &&
            typeof contract.secType === 'string' &&
            SEC_TYPE.BAG.toUpperCase() === contract.secType.toUpperCase()
        ) {
            if (Array.isArray(order.orderComboLegs)) {
                order.orderComboLegs.forEach(
                    orderComboLeg=>
                        orderComboLeg.price !== Number.MAX_VALUE &&
                        this._emitError(id, BROKER_ERRORS.UPDATE_TWS,'It does not support per-leg prices for order combo legs.')   
                )
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.TRAILING_PERCENT) {
            if (order.trailingPercent && order.trailingPercent !== Number.MAX_VALUE) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,'It does not support trailing percent parameter.')
            }
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass)) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
                    'It does not support tradingClass parameters in placeOrder.'
                )
            }
        }

        if (this._serverVersion < MIN_SERVER_VER.ALGO_ID && !isEmpty(order.algoId)) {
            return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,'It does not support algoId parameter.')
        }

        if (this._serverVersion < MIN_SERVER_VER.SCALE_TABLE) {
            if (
                !isEmpty(order.scaleTable) ||
                !isEmpty(order.activeStartTime) ||
                !isEmpty(order.activeStopTime)
            ) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
                    'It does not support scaleTable, activeStartTime and activeStopTime parameters.'
                )
            }
        }

        if (this._serverVersion < MIN_SERVER_VER.ORDER_SOLICITED) {
            if (order.solicited) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
                    'It does not support order solicited parameter.'
                )
            }
        }

        if (this._serverVersion < MIN_SERVER_VER.MODELS_SUPPORT) {
            if (!isEmpty(order.modelCode)) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
                    'It does not support model code parameter.'
                )
            }
        }

        if (this._serverVersion < MIN_SERVER_VER.EXT_OPERATOR && !isEmpty(order.extOperator)) {
            return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
                'It does not support ext operator'
            )
        }

        if (this._serverVersion < MIN_SERVER_VER.SOFT_DOLLAR_TIER
            && (order.softDollarTier && (!isEmpty(order.softDollarTier.name) || !isEmpty(order.softDollarTier.value)))){
            return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
                'It does not support soft dollar tier.'
            )
        }

        if (this._serverVersion < MIN_SERVER_VER.CASH_QTY) {
            if (order.cashQty && order.cashQty != Number.MAX_VALUE) {
                return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
                    'It does not support cash quantity parameter.'
                )
            }
        }

        if (this._serverVersion < MIN_SERVER_VER.DECISION_MAKER
            && (!isEmpty(order.mifid2DecisionMaker) || !isEmpty(order.mifid2DecisionAlgo))) {
            return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
                'It does not support MIFID II decision maker parameters.'
            )

        }

        if (this._serverVersion < MIN_SERVER_VER.MIFID_EXECUTION
            && (!isEmpty(order.mifid2ExecutionTrader) || !isEmpty(order.mifid2ExecutionAlgo))) {
            return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
                ' It does not support MIFID II execution parameters'
            )
        }

        if (this._serverVersion < MIN_SERVER_VER.AUTO_PRICE_FOR_HEDGE && order.dontUseAutoPriceForHedge) {
            return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
                "It does not support don't use auto price for hedge parameter."
            )

        }

        if (this._serverVersion < MIN_SERVER_VER.ORDER_CONTAINER && order.isOmsContainer) {
            return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
                'It does not support oms container parameter.'
            )
        }

        if (this._serverVersion < MIN_SERVER_VER.D_PEG_ORDERS && order.discretionaryUpToLimitPrice) {
            return this._emitError(id, BROKER_ERRORS.UPDATE_TWS,
                'It does not support D-Peg orders.'
            )
        }


        let version = this._serverVersion < MIN_SERVER_VER.NOT_HELD ? 27 : 45
        // send place order msg
        let buffer = [this._encode(OUTGOING.PLACE_ORDER)]

        if (this._serverVersion < MIN_SERVER_VER.ORDER_CONTAINER) {
            buffer.push(this._encode(version))
        }

        buffer.push(this._encode(id))

        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.PLACE_ORDER_CONID) {
            buffer.push(this._encode(contract.conId))
        }
        buffer.push(this._encode(contract.symbol))
        buffer.push(this._encode(contract.secType))
        buffer.push(this._encode(contract.expiry))
        buffer.push(this._encode(contract.strike))
        buffer.push(this._encode(contract.right))
        if (this._serverVersion >= 15) {
            buffer.push(this._encode(contract.multiplier))
        }
        buffer.push(this._encode(contract.exchange))
        if (this._serverVersion >= 14) {
            buffer.push(this._encode(contract.primaryExch))
        }
        buffer.push(this._encode(contract.currency))
        if (this._serverVersion >= 2) {
            buffer.push(this._encode(contract.localSymbol))
        }
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(this._encode(contract.tradingClass))
        }
        if (this._serverVersion >= MIN_SERVER_VER.SEC_ID_TYPE) {
            buffer.push(this._encode(contract.secIdType))
            buffer.push(this._encode(contract.secId))
        }
        // send main order fields
        buffer.push(this._encode(order.action))

        if (this._serverVersion >= MIN_SERVER_VER.FRACTIONAL_POSITIONS)
            buffer.push(this._encode(order.totalQuantity))
        else
            buffer.push(this._encode(parseInt(order.totalQuantity,10)))

        buffer.push(this._encode(order.orderType))
        if (this._serverVersion < MIN_SERVER_VER.ORDER_COMBO_LEGS_PRICE) {
            buffer.push(this._encode(order.lmtPrice === Number.MAX_VALUE ? 0 : order.lmtPrice))
        } else {
            buffer.push(this._encodeMax(order.lmtPrice))
        }
        if (this._serverVersion < MIN_SERVER_VER.TRAILING_PERCENT) {
            buffer.push(this._encode(order.auxPrice === Number.MAX_VALUE ? 0 : order.auxPrice))
        } else {
            buffer.push(this._encodeMax(order.auxPrice))
        }
        // send extended order fields
        buffer.push(this._encode(order.tif))
        buffer.push(this._encode(order.ocaGroup))
        buffer.push(this._encode(order.account))
        buffer.push(this._encode(order.openClose))
        buffer.push(this._encode(order.origin))
        buffer.push(this._encode(order.orderRef))
        buffer.push(this._encode(order.transmit))
        if (this._serverVersion >= 4) {
            buffer.push(this._encode(order.parentId))
        }
        if (this._serverVersion >= 5) {
            buffer.push(this._encode(order.blockOrder))
            buffer.push(this._encode(order.sweepToFill))
            buffer.push(this._encode(order.displaySize))
            buffer.push(this._encode(order.triggerMethod))
            if (this._serverVersion < 38) {
                // will never happen
                buffer.push(this._encode(/* order.ignoreRth */ false))
            } else {
                buffer.push(this._encode(order.outsideRth))
            }
        }
        if (this._serverVersion >= 7) {
            buffer.push(this._encode(order.hidden))
        }
        // Send combo legs for BAG requests
        if (
            this._serverVersion >= 8 &&
            typeof contract.secType === 'string' &&
            SEC_TYPE.BAG.toUpperCase() === contract.secType.toUpperCase()
        ) {
            if (!Array.isArray(contract.comboLegs)) {
                buffer.push(this._encode(0))
            } else {
                buffer.push(this._encode(contract.comboLegs.length))
                contract.comboLegs.forEach(
                    comboLeg=> {
                        buffer.push(this._encode(comboLeg.conId))
                        buffer.push(this._encode(comboLeg.ratio))
                        buffer.push(this._encode(comboLeg.action))
                        buffer.push(this._encode(comboLeg.exchange))
                        buffer.push(this._encode(comboLeg.openClose))
                        if (this._serverVersion >= MIN_SERVER_VER.SSHORT_COMBO_LEGS) {
                            buffer.push(this._encode(comboLeg.shortSaleSlot))
                            buffer.push(this._encode(comboLeg.designatedLocation))
                        }
                        if (this._serverVersion >= MIN_SERVER_VER.SSHORTX_OLD) {
                            buffer.push(this._encode(comboLeg.exemptCode))
                        }
                    }
                )
            }
        }
        // Send order combo legs for BAG requests
        if (
            this._serverVersion >= MIN_SERVER_VER.ORDER_COMBO_LEGS_PRICE &&
            typeof contract.secType === 'string' &&
            SEC_TYPE.BAG.toUpperCase() === contract.secType.toUpperCase()
        ) {
            if (!Array.isArray(order.orderComboLegs)) {
                buffer.push(this._encode(0))
            } else {
                buffer.push(this._encode(order.orderComboLegs.length))
                order.orderComboLegs.forEach(orderComboLeg=>
                    buffer.push(this._encodeMax(orderComboLeg.price))
                )
            }
        }
        let smartComboRoutingParamsCount
        if (
            this._serverVersion >= MIN_SERVER_VER.SMART_COMBO_ROUTING_PARAMS &&
            typeof contract.secType === 'string' &&
            SEC_TYPE.BAG.toUpperCase() === contract.secType.toUpperCase()
        ) {
            smartComboRoutingParamsCount = !Array.isArray(order.smartComboRoutingParams)
                ? 0
                : order.smartComboRoutingParams.length
            buffer.push(this._encode(smartComboRoutingParamsCount))
            if (smartComboRoutingParamsCount > 0) {
                order.smartComboRoutingParams.forEach(tagValue=> {
                    buffer.push(this._encode(tagValue.tag))
                    buffer.push(this._encode(tagValue.value))
                })
            }
        }
        if (this._serverVersion >= 9) {
            // send deprecated sharesAllocation field
            buffer.push(this._encode(''))
        }
        if (this._serverVersion >= 10) {
            buffer.push(this._encode(order.discretionaryAmt))
        }
        if (this._serverVersion >= 11) {
            buffer.push(this._encode(order.goodAfterTime))
        }
        if (this._serverVersion >= 12) {
            buffer.push(this._encode(order.goodTillDate))
        }
        if (this._serverVersion >= 13) {
            buffer.push(this._encode(order.faGroup))
            buffer.push(this._encode(order.faMethod))
            buffer.push(this._encode(order.faPercentage))
            buffer.push(this._encode(order.faProfile))
        }

        if (this._serverVersion >= MIN_SERVER_VER.MODELS_SUPPORT) {
            buffer.push(this._encode(order.modelCode))
        }

        if (this._serverVersion >= 18) {
            // institutional short sale slot fields.
            buffer.push(this._encode(order.shortSaleSlot)) // 0 only for retail, 1 or 2 only for institution.
            buffer.push(this._encode(order.designatedLocation)) // only populate when order.shortSaleSlot = 2.
        }
        if (this._serverVersion >= MIN_SERVER_VER.SSHORTX_OLD) {
            buffer.push(this._encode(order.exemptCode))
        }
        let lower
        let upper
        if (this._serverVersion >= 19) {
            buffer.push(this._encode(order.ocaType))
            if (this._serverVersion < 38) {
                // will never happen
                buffer.push(this._encode(/* order.rthOnly */ false))
            }
            buffer.push(this._encode(order.rule80A))
            buffer.push(this._encode(order.settlingFirm))
            buffer.push(this._encode(order.allOrNone))
            buffer.push(this._encodeMax(order.minQty))
            buffer.push(this._encodeMax(order.percentOffset))
            buffer.push(this._encode(order.eTradeOnly))
            buffer.push(this._encode(order.firmQuoteOnly))
            buffer.push(this._encodeMax(order.nbboPriceCap))
            buffer.push(this._encodeMax(order.auctionStrategy))
            buffer.push(this._encodeMax(order.startingPrice))
            buffer.push(this._encodeMax(order.stockRefPrice))
            buffer.push(this._encodeMax(order.delta))
            // Volatility orders had specific watermark price attribs in server version 26
            lower =
                this._serverVersion === 26 && order.orderType === 'VOL'
                    ? Number.MAX_VALUE
                    : order.stockRangeLower
            upper =
                this._serverVersion === 26 && order.orderType === 'VOL'
                    ? Number.MAX_VALUE
                    : order.stockRangeUpper
            buffer.push(this._encodeMax(lower))
            buffer.push(this._encodeMax(upper))
        }
        if (this._serverVersion >= 22) {
            buffer.push(this._encode(order.overridePercentageConstraints))
        }
        if (this._serverVersion >= 26) {
            // Volatility orders
            buffer.push(this._encodeMax(order.volatility))
            buffer.push(this._encodeMax(order.volatilityType))
            if (this._serverVersion < 28) {
                buffer.push(this._encode(order.deltaNeutralOrderType.toUpperCase()) === 'MKT')
            } else {
                buffer.push(this._encode(order.deltaNeutralOrderType))
                buffer.push(this._encodeMax(order.deltaNeutralAuxPrice))
                if (
                    this._serverVersion >= MIN_SERVER_VER.DELTA_NEUTRAL_CONID &&
                    !isEmpty(order.deltaNeutralOrderType)
                ) {
                    buffer.push(this._encode(order.deltaNeutralConId))
                    buffer.push(this._encode(order.deltaNeutralSettlingFirm))
                    buffer.push(this._encode(order.deltaNeutralClearingAccount))
                    buffer.push(this._encode(order.deltaNeutralClearingIntent))
                }
                if (
                    this._serverVersion >= MIN_SERVER_VER.DELTA_NEUTRAL_OPEN_CLOSE &&
                    !isEmpty(order.deltaNeutralOrderType)
                ) {
                    buffer.push(this._encode(order.deltaNeutralOpenClose))
                    buffer.push(this._encode(order.deltaNeutralShortSale))
                    buffer.push(this._encode(order.deltaNeutralShortSaleSlot))
                    buffer.push(this._encode(order.deltaNeutralDesignatedLocation))
                }
            }
            buffer.push(this._encode(order.continuousUpdate))
            if (this._serverVersion === 26) {
                // Volatility orders had specific watermark price attribs in server version 26
                lower = order.orderType === 'VOL' ? order.stockRangeLower : Number.MAX_VALUE
                upper = order.orderType === 'VOL' ? order.stockRangeUpper : Number.MAX_VALUE
                buffer.push(this._encodeMax(lower))
                buffer.push(this._encodeMax(upper))
            }
            buffer.push(this._encodeMax(order.referencePriceType))
        }
        if (this._serverVersion >= 30) {
            // TRAIL_STOP_LIMIT stop price
            buffer.push(this._encodeMax(order.trailStopPrice))
        }
        if (this._serverVersion >= MIN_SERVER_VER.TRAILING_PERCENT) {
            buffer.push(this._encodeMax(order.trailingPercent))
        }
        if (this._serverVersion >= MIN_SERVER_VER.SCALE_ORDERS) {
            if (this._serverVersion >= MIN_SERVER_VER.SCALE_ORDERS2) {
                buffer.push(this._encodeMax(order.scaleInitLevelSize))
                buffer.push(this._encodeMax(order.scaleSubsLevelSize))
            } else {
                buffer.push(this._encode(''))
                buffer.push(this._encodeMax(order.scaleInitLevelSize))
            }
            buffer.push(this._encodeMax(order.scalePriceIncrement))
        }
        if (
            this._serverVersion >= MIN_SERVER_VER.SCALE_ORDERS3 &&
            order.scalePriceIncrement > 0.0 &&
            order.scalePriceIncrement !== Number.MAX_VALUE
        ) {
            buffer.push(this._encodeMax(order.scalePriceAdjustValue))
            buffer.push(this._encodeMax(order.scalePriceAdjustInterval))
            buffer.push(this._encodeMax(order.scaleProfitOffset))
            buffer.push(this._encode(order.scaleAutoReset))
            buffer.push(this._encodeMax(order.scaleInitPosition))
            buffer.push(this._encodeMax(order.scaleInitFillQty))
            buffer.push(this._encode(order.scaleRandomPercent))
        }
        if (this._serverVersion >= MIN_SERVER_VER.SCALE_TABLE) {
            buffer.push(this._encode(order.scaleTable))
            buffer.push(this._encode(order.activeStartTime))
            buffer.push(this._encode(order.activeStopTime))
        }
        if (this._serverVersion >= MIN_SERVER_VER.HEDGE_ORDERS) {
            buffer.push(this._encode(order.hedgeType))
            if (!isEmpty(order.hedgeType)) {
                buffer.push(this._encode(order.hedgeParam))
            }
        }
        if (this._serverVersion >= MIN_SERVER_VER.OPT_OUT_SMART_ROUTING) {
            buffer.push(this._encode(order.optOutSmartRouting))
        }
        if (this._serverVersion >= MIN_SERVER_VER.PTA_ORDERS) {
            buffer.push(this._encode(order.clearingAccount))
            buffer.push(this._encode(order.clearingIntent))
        }
        if (this._serverVersion >= MIN_SERVER_VER.NOT_HELD) {
            buffer.push(this._encode(order.notHeld))
        }
        if (this._serverVersion >= MIN_SERVER_VER.DELTA_NEUTRAL) {
            if (isPlainObject(contract.deltaNeutralContract) && !isEmpty(contract.deltaNeutralContract)) {
                buffer.push(this._encode(true))
                buffer.push(this._encode(contract.deltaNeutralContract.conId))
                buffer.push(this._encode(contract.deltaNeutralContract.delta))
                buffer.push(this._encode(contract.deltaNeutralContract.price))
            } else {
                buffer.push(this._encode(false))
            }
        }
        let algoParamsCount
        if (this._serverVersion >= MIN_SERVER_VER.ALGO_ORDERS) {
            buffer.push(this._encode(order.algoStrategy))
            if (!isEmpty(order.algoStrategy)) {
                algoParamsCount = !Array.isArray(order.algoParams) ? 0 : order.algoParams.length
                buffer.push(this._encode(algoParamsCount))
                if (algoParamsCount > 0) {
                    order.algoParams.forEach(function (tagValue) {
                        buffer.push(this._encode(tagValue.tag))
                        buffer.push(this._encode(tagValue.value))
                    })
                }
            }
        }
        if (this._serverVersion >= MIN_SERVER_VER.ALGO_ID) {
            buffer.push(this._encode(order.algoid))
        }

        if (this._serverVersion >= MIN_SERVER_VER.WHAT_IF_ORDERS) {
            buffer.push(this._encode(order.whatIf))
        }
        
        if (this._serverVersion >= MIN_SERVER_VER.LINKING) {
            buffer.push(this._encode(order.orderMiscOptions))
        }

        if (this._serverVersion >= MIN_SERVER_VER.ORDER_SOLICITED) {
            buffer.push(this._encode(order.solicited))
        }

        if (this._serverVersion >= MIN_SERVER_VER.RANDOMIZE_SIZE_AND_PRICE) {
            buffer.push(this._encode(order.randomizeSize))
            buffer.push(this._encode(order.randomizePrice))
        }

        if (this._serverVersion >= MIN_SERVER_VER.PEGGED_TO_BENCHMARK) {
            if (order.orderType === ORDER_TYPE.PEG_BENCH) {
                buffer.push(this._encode(order.referenceContractId))
                buffer.push(this._encode(order.isPeggedChangeAmountDecrease))
                buffer.push(this._encode(order.peggedChangeAmount))
                buffer.push(this._encode(order.referenceChangeAmount))
                buffer.push(this._encode(order.randomizeSize))
            }

            buffer.push(this._encode(Array.isArray(order.conditions)?order.conditions.length:0))

            if (Array.isArray(order.conditions) && order.conditions.length > 0){
                order.conditions.forEach(condition => {
                    buffer.push(this._encode(condition.type))
                    buffer.push(this._encode(condition))
                    
                })
                buffer.push(this._encode(order.conditionsIgnoreRth))
                buffer.push(this._encode(order.conditionsCancelOrder))
            }

            buffer.push(this._encode(order.adjustedOrderType))
            buffer.push(this._encode(order.triggerPrice))
            buffer.push(this._encode(order.lmtPriceOffset))
            buffer.push(this._encode(order.adjustedStopPrice))
            buffer.push(this._encode(order.adjustedStopLimitPrice))
            buffer.push(this._encode(order.adjustedTrailingAmount))
            buffer.push(this._encode(order.adjustableTrailingUnit))
        }

        if (this._serverVersion >= MIN_SERVER_VER.EXT_OPERATOR) {
            buffer.push(this._encode(order.extOperator))
        }

        if (this._serverVersion >= MIN_SERVER_VER.SOFT_DOLLAR_TIER) {
            buffer.push(this._encode(order.softDollarTier && order.softDollarTier.name || null))
            buffer.push(this._encode(order.softDollarTier && order.softDollarTier.value || null))
        }

        if (this._serverVersion >= MIN_SERVER_VER.CASH_QTY) {
            buffer.push(this._encode(order.cashQty))
        }

        if (this._serverVersion >= MIN_SERVER_VER.DECISION_MAKER) {
            buffer.push(this._encode(order.mifid2DecisionMaker))
            buffer.push(this._encode(order.mifid2DecisionAlgo))
        }

        if (this._serverVersion >= MIN_SERVER_VER.MIFID_EXECUTION) {
            buffer.push(this._encode(order.mifid2ExecutionTrader))
            buffer.push(this._encode(order.mifid2ExecutionAlgo))
        }

        if (this._serverVersion >= MIN_SERVER_VER.AUTO_PRICE_FOR_HEDGE) {
            buffer.push(this._encode(order.dontUseAutoPriceForHedge))
        }

        if (this._serverVersion >= MIN_SERVER_VER.ORDER_CONTAINER) {
            buffer.push(this._encode(order.isOmsContainer))
        }

        if (this._serverVersion >= MIN_SERVER_VER.D_PEG_ORDERS) {
            buffer.push(this._encode(order.discretionaryUpToLimitPrice))
        }

        return buffer
    }

    reqAccountUpdates(subscribe, acctCode) {
        let version = 2

        if (this._serverVersion >= 9) {
            return [this._encode(OUTGOING.REQ_ACCOUNT_DATA), this._encode(version), this._encode(subscribe), this._encode(acctCode)]
        } else {
            return [this._encode(OUTGOING.REQ_ACCOUNT_DATA), this._encode(version), this._encode(subscribe)]
        }
    }

    reqExecutions(reqId, filter) {
        // NOTE: Time format must be 'yyyymmdd-hh:mm:ss' E.g. '20030702-14:55'
        let version = 3
        // send req open orders msg
        let buffer = [this._encode(OUTGOING.REQ_EXECUTIONS), this._encode(version)]

        if (this._serverVersion >= MIN_SERVER_VER.EXECUTION_DATA_CHAIN) {
            buffer.push(this._encode(reqId))
        }
        // Send the execution rpt filter data 
        if (this._serverVersion >=9) {
            buffer.push(this._encode(filter.clientId))
            buffer.push(this._encode(filter.acctCode))
            // Note that the valid format for m_time is "yyyymmdd-hh:mm:ss"
            buffer.push(this._encode(filter.time))
            buffer.push(this._encode(filter.symbol))
            buffer.push(this._encode(filter.secType))
            buffer.push(this._encode(filter.exchange))
            buffer.push(this._encode(filter.side))
        }

        return buffer
    }

    cancelOrder(id) {
        let version = 1
        let buffer = [this._encode(OUTGOING.CANCEL_ORDER), this._encode(version), this._encode(id)]

        return buffer
    }

    reqOpenOrders() {
        let version = 1
        return [this._encode(OUTGOING.REQ_OPEN_ORDERS), this._encode(version)]
    }

    reqIds(numIds) {
        let version = 1
        return [this._encode(OUTGOING.REQ_IDS), this._encode(version), this._encode(numIds)]
    }

    reqNewsBulletins(allMsgs) {
        let version = 1
        return [this._encode(OUTGOING.REQ_NEWS_BULLETINS), this._encode(version), this._encode(allMsgs)]
    }
  
    cancelNewsBulletins() {
        let version = 1
        let buffer = [this._encode(OUTGOING.CANCEL_NEWS_BULLETINS), this._encode(version)]

        return buffer
    }
      
    setServerLogLevel(logLevel) {
        let version = 1
        return [this._encode(OUTGOING.SET_SERVER_LOGLEVEL), this._encode(version), this._encode(logLevel)]
    }

    reqAutoOpenOrders(bAutoBind) {
        let version = 1
        return [this._encode(OUTGOING.REQ_AUTO_OPEN_ORDERS), this._encode(version), this._encode(bAutoBind)]
    }

    reqAllOpenOrders() {
        let version = 1
        return [this._encode(OUTGOING.REQ_ALL_OPEN_ORDERS), this._encode(version)]
    }

    reqManagedAccts() {
        let version = 1
        return [this._encode(OUTGOING.REQ_MANAGED_ACCTS), this._encode(version)]
    }

    requestFA(faDataType) {
        if (this._serverVersion < 13) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS,'This feature is only available for versions of TWS >= 13.')
        }
        let version = 1
        return [this._encode(OUTGOING.REQ_FA), this._encode(version), this._encode(faDataType)]
    }

    replaceFA(faDataType, xml) {
        if (this._serverVersion < 13) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS,'This feature is only available for versions of TWS >= 13.')
        }
        let version = 1
        return [this._encode(OUTGOING.REPLACE_FA), this._encode(version), this._encode(faDataType), this._encode(xml)]
    }

    reqCurrentTime() {
        if (this._serverVersion < 33) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS,'It does not support current time requests.')
        }
        let version = 1
        return [this._encode(OUTGOING.REQ_CURRENT_TIME), this._encode(version)]
        
    }

    reqFundamentalData(reqId, contract, reportType, fundamentalDataOptions=null) {
        if (this._serverVersion < MIN_SERVER_VER.FUNDAMENTAL_DATA) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support fundamental data requests.')
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (contract.conId > 0) {
                return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,
                    'It does not support conId parameter in reqFundamentalData.'
                )
            }
        }
        let version = 2
        // send req fund data msg
        let buffer = [this._encode(OUTGOING.REQ_FUNDAMENTAL_DATA), this._encode(version), this._encode(reqId)]
        // send contract fields
        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(this._encode(contract.conId))
        }
        buffer.push(this._encode(contract.symbol))
        buffer.push(this._encode(contract.secType))
        buffer.push(this._encode(contract.exchange))
        buffer.push(this._encode(contract.primaryExch))
        buffer.push(this._encode(contract.currency))
        buffer.push(this._encode(contract.localSymbol))
        buffer.push(this._encode(reportType))

        if (this._serverVersion >= MIN_SERVER_VER.LINKING) {
            buffer.push(this._encode(fundamentalDataOptions))
        }

        return buffer
    }

    cancelFundamentalData(reqId) {
        if (this._serverVersion < MIN_SERVER_VER.FUNDAMENTAL_DATA) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support fundamental data requests.')
        }
        let version = 1
        let buffer = [this._encode(OUTGOING.CANCEL_FUNDAMENTAL_DATA), this._encode(version), this._encode(reqId)]

        return buffer
    }

    calculateImpliedVolatility(reqId, contract, optionPrice, underPrice, impliedVolatilityOptions=null) {
        if (this._serverVersion < MIN_SERVER_VER.REQ_CALC_IMPLIED_VOLAT) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,
                'It does not support calculate implied volatility requests.'
            )
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass)) {
                return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,
                    'It does not support tradingClass parameter in calculateImpliedVolatility.'
                )
            }
        }
        let version = 2
        let buffer = [this._encode(OUTGOING.REQ_CALC_IMPLIED_VOLAT), this._encode(version), this._encode(reqId)]
        // send contract fields
        buffer.push(this._encode(contract.conId))
        buffer.push(this._encode(contract.symbol))
        buffer.push(this._encode(contract.secType))
        buffer.push(this._encode(contract.expiry))
        buffer.push(this._encode(contract.strike))
        buffer.push(this._encode(contract.right))
        buffer.push(this._encode(contract.multiplier))
        buffer.push(this._encode(contract.exchange))
        buffer.push(this._encode(contract.primaryExch))
        buffer.push(this._encode(contract.currency))
        buffer.push(this._encode(contract.localSymbol))

        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(this._encode(contract.tradingClass))
        }
        
        buffer.push(this._encode(optionPrice))
        buffer.push(this._encode(underPrice))

        if (this._serverVersion >= MIN_SERVER_VER.LINKING) {
            buffer.push(this._encode(impliedVolatilityOptions))
        }

        return buffer
    }

    cancelCalculateImpliedVolatility(reqId) {
        if (this._serverVersion < MIN_SERVER_VER.CANCEL_CALC_IMPLIED_VOLAT) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,
                'It does not support calculate implied volatility cancellation.'
            )
        }
        let version = 1
        let buffer = [this._encode(OUTGOING.CANCEL_CALC_IMPLIED_VOLAT), this._encode(version), this._encode(reqId)]

        return buffer
    }

    calculateOptionPrice(reqId, contract, volatility, underPrice, optionPriceOptions=null) {
        if (this._serverVersion < MIN_SERVER_VER.REQ_CALC_OPTION_PRICE) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support calculate option price requests.')
        }
        if (this._serverVersion < MIN_SERVER_VER.TRADING_CLASS) {
            if (!isEmpty(contract.tradingClass)) {
                return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,
                    'It does not support tradingClass parameter in calculateOptionPrice.'
                )
            }
        }
        let version = 2
        let buffer = [this._encode(OUTGOING.REQ_CALC_OPTION_PRICE), this._encode(version), this._encode(reqId)]
        // send contract fields
        buffer.push(this._encode(contract.conId))
        buffer.push(this._encode(contract.symbol))
        buffer.push(this._encode(contract.secType))
        buffer.push(this._encode(contract.expiry))
        buffer.push(this._encode(contract.strike))
        buffer.push(this._encode(contract.right))
        buffer.push(this._encode(contract.multiplier))
        buffer.push(this._encode(contract.exchange))
        buffer.push(this._encode(contract.primaryExch))
        buffer.push(this._encode(contract.currency))
        buffer.push(this._encode(contract.localSymbol))

        if (this._serverVersion >= MIN_SERVER_VER.TRADING_CLASS) {
            buffer.push(this._encode(contract.tradingClass))
        }

        buffer.push(this._encode(volatility))
        buffer.push(this._encode(underPrice))
        
        if (this._serverVersion >= MIN_SERVER_VER.LINKING) {
            buffer.push(this._encode(optionPriceOptions))
        }

        return buffer
    }

    cancelCalculateOptionPrice(reqId) {
        if (this._serverVersion < MIN_SERVER_VER.CANCEL_CALC_OPTION_PRICE) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support calculate option price cancellation.')
        }
        let version = 1
        let buffer = [this._encode(OUTGOING.CANCEL_CALC_OPTION_PRICE), this._encode(version), this._encode(reqId)]

        return buffer
    }

    reqGlobalCancel() {
        if (this._serverVersion < MIN_SERVER_VER.REQ_GLOBAL_CANCEL) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS,'It does not support globalCancel requests.')
        }
        let version = 1
        return [this._encode(OUTGOING.REQ_GLOBAL_CANCEL), this._encode(version)]
    }

    reqMarketDataType(marketDataType) {
        if (this._serverVersion < MIN_SERVER_VER.REQ_MARKET_DATA_TYPE) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS,'It does not support marketDataType requests.')
        }
        let version = 1
        return [this._encode(OUTGOING.REQ_MARKET_DATA_TYPE), this._encode(version), this._encode(marketDataType)]
    }
    
    reqPositions() {
        if (this._serverVersion < MIN_SERVER_VER.ACCT_SUMMARY) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS,'It does not support position requests.')
        }
        let version = 1
        return [this._encode(OUTGOING.REQ_POSITIONS), this._encode(version)]
    }

    reqSecDefOptParams(reqId, underlyingSymbol, futFopExchange, underlyingSecType, underlyingConId) {
        if (this._serverVersion < MIN_SERVER_VER.SEC_DEF_OPT_PARAMS_REQ) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support reqSecDefOptParams.')
        }
        return [
            this._encode(OUTGOING.REQ_SEC_DEF_OPT_PARAMS),
            this._encode(reqId),
            this._encode(underlyingSymbol),
            this._encode(futFopExchange),
            this._encode(underlyingSecType),
            this._encode(underlyingConId) 
        ]
    }

    reqSoftDollarTiers(reqId) {
        if (this._serverVersion < MIN_SERVER_VER.SOFT_DOLLAR_TIER) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support soft dollar tier requests.')
        }
        return [ 
            this._encode(OUTGOING.SOFT_DOLLAR_TIER),
            this._encode(reqId)
        ]
    }
    
    cancelPositions() {
        if (this._serverVersion < MIN_SERVER_VER.ACCT_SUMMARY) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS,'It does not support position cancellation.')
        }
        let version = 1
        let buffer = [this._encode(OUTGOING.CANCEL_POSITIONS), this._encode(version)]

        return buffer
    }

    reqPositionsMulti(reqId, account, modelCode) {
        if (this._serverVersion < MIN_SERVER_VER.MODELS_SUPPORT) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support positions multi request.')
        }
        let version = 1
        return [this._encode(OUTGOING.REQ_POSITIONS_MULTI), this._encode(version), this._encode(reqId), this._encode(account), this._encode(modelCode)]
    }

    cancelPositionsMulti(reqId) {
        if (this._serverVersion < MIN_SERVER_VER.MODELS_SUPPORT) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support positions multi cancellation.')
        }
        let version = 1
        let buffer = [this._encode(OUTGOING.CANCEL_POSITIONS_MULTI), this._encode(version), this._encode(reqId)]

        return buffer
    }

    cancelAccountUpdatesMulti(reqId) {
        if (this._serverVersion < MIN_SERVER_VER.MODELS_SUPPORT) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support account updates multi cancellation.')
        }
        
        let version = 1
        let buffer = [this._encode(OUTGOING.CANCEL_ACCOUNT_UPDATES_MULTI), this._encode(version), this._encode(reqId)]

        return buffer
    }

    reqAccountUpdatesMulti(reqId, acctCode, modelCode, ledgerAndNLV) {

        if (this._serverVersion < MIN_SERVER_VER.MODELS_SUPPORT) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support account updates multi requests.')
        }

        let version = 1
        return [this._encode(OUTGOING.REQ_ACCOUNT_UPDATES_MULTI),
        this._encode(version),
        this._encode(reqId),
        this._encode(acctCode),
        this._encode(modelCode),
        this._encode(ledgerAndNLV)]
        
    }

    reqAccountSummary(reqId, group, tags) {
        if (this._serverVersion < MIN_SERVER_VER.ACCT_SUMMARY) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support account summary requests.')
        }
        let version = 1
        return [this._encode(OUTGOING.REQ_ACCOUNT_SUMMARY), this._encode(version), this._encode(reqId), this._encode(group), this._encode(tags)]
    }

    cancelAccountSummary(reqId) {
        if (this._serverVersion < MIN_SERVER_VER.ACCT_SUMMARY) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support account summary cancellation.')
        }
        let version = 1
        let buffer = [this._encode(OUTGOING.CANCEL_ACCOUNT_SUMMARY), this._encode(version), this._encode(reqId)]

        return buffer
    }

    verifyRequest(apiName, apiVersion) {
        if (this._serverVersion < MIN_SERVER_VER.LINKING) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS, 'It does not support verification request.')
        }

        /*if (!extraAuth) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS,'Intent to authenticate needs to be expressed during initial connect request.')
        }*/

        let version = 1
        let buffer = [this._encode(OUTGOING.VERIFY_REQUEST), this._encode(version), this._encode(apiName), this._encode(apiVersion)]

        return buffer
    }

    verifyMessage(apiData) {
        if (this._serverVersion < MIN_SERVER_VER.LINKING) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS, 'It does not support verification message sending.')
        }

        let version = 1
        let buffer = [this._encode(OUTGOING.VERIFY_MESSAGE), this._encode(version), this._encode(apiData)]

        return buffer
    }

    verifyAndAuthRequest(apiName, apiVersion, opaqueIsvKey) {
        if (this._serverVersion < MIN_SERVER_VER.LINKING_AUTH) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS, 'It does not support verification request.')
        }

        /*if (!extraAuth) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS,'Intent to authenticate needs to be expressed during initial connect request.')
        }*/

        let version = 1
        let buffer = [this._encode(OUTGOING.VERIFY_AND_AUTH_REQUEST), this._encode(version), this._encode(apiName), this._encode(apiVersion), this._encode(opaqueIsvKey)]

        return buffer
    }

    verifyAndAuthMessage(apiData, xyzResponse) {
        if (this._serverVersion < MIN_SERVER_VER.LINKING_AUTH) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS, 'It does not support verification message sending.')
        }

        let version = 1
        let buffer = [this._encode(OUTGOING.VERIFY_AND_AUTH_MESSAGE), this._encode(version), this._encode(apiData), this._encode(xyzResponse)]

        return buffer
    }

    queryDisplayGroups(reqId) {

        if (this._serverVersion < MIN_SERVER_VER.LINKING) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support queryDisplayGroups request.')
        }
        let version = 1
        return [this._encode(OUTGOING.QUERY_DISPLAY_GROUPS), this._encode(version), this._encode(reqId)]
    }

    subscribeToGroupEvents(reqId, groupId) {
        if (this._serverVersion < MIN_SERVER_VER.LINKING) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support subscribeToGroupEvents request.')
        }

        let version = 1
        return [this._encode(OUTGOING.SUBSCRIBE_TO_GROUP_EVENTS), this._encode(version), this._encode(reqId), this._encode(groupId)]
    }

    updateDisplayGroup(reqId, contractInfo) {

        if (this._serverVersion < MIN_SERVER_VER.LINKING) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support updateDisplayGroup request.')
        }

        let version = 1
        return [this._encode(OUTGOING.UPDATE_DISPLAY_GROUP), this._encode(version), this._encode(reqId), this._encode(contractInfo)]
    }

    unsubscribeFromGroupEvents(reqId) {

        if (this._serverVersion < MIN_SERVER_VER.LINKING) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support unsubscribeFromGroupEvents request.')
        }

        let version = 1
        return [this._encode(OUTGOING.UNSUBSCRIBE_FROM_GROUP_EVENTS), this._encode(version), this._encode(reqId)]
    }

    reqMatchingSymbols(reqId,pattern) {
        if (this._serverVersion < MIN_SERVER_VER.REQ_MATCHING_SYMBOLS) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support matching symbols request.')
        }
        return [
            this._encode(OUTGOING.REQ_MATCHING_SYMBOLS),
            this._encode(reqId),
            this._encode(pattern)
        ]
    }

    reqFamilyCodes() {
        if (this._serverVersion < MIN_SERVER_VER.REQ_FAMILY_CODES) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS,'It does not support family codes request.')
        }
        return [
            this._encode(OUTGOING.REQ_FAMILY_CODES)
        ]
    }


    reqMktDepthExchanges() {
        if (this._serverVersion < MIN_SERVER_VER.REQ_MKT_DEPTH_EXCHANGES) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS,'It does not support market depth exchanges request.')
        }
        return [
            this._encode(OUTGOING.REQ_MKT_DEPTH_EXCHANGES)
        ]
    }

    reqSmartComponents(reqId, bboExchange) {
        if (this._serverVersion < MIN_SERVER_VER.REQ_SMART_COMPONENTS) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support smart components request.')
        }
        return [
            this._encode(OUTGOING.REQ_SMART_COMPONENTS), this._encode(reqId), this._encode(bboExchange)
        ]
    }

    reqNewsProviders() {
        if (this._serverVersion < MIN_SERVER_VER.REQ_NEWS_PROVIDERS) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS,'It does not support news providers request.')
        }
        return [
            this._encode(OUTGOING.REQ_NEWS_PROVIDERS)
        ]
    }

    reqNewsArticle(reqId, providerCode, articleId = null, newsArticleOptions) {
        if (this._serverVersion < MIN_SERVER_VER.REQ_NEWS_ARTICLE) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support news article request.')
        }
        let buffer= [
            this._encode(OUTGOING.REQ_NEWS_ARTICLE), 
            this._encode(reqId),
            this._encode(providerCode),
            this._encode(articleId)
        ]
        if (this._serverVersion >= MIN_SERVER_VER.NEWS_QUERY_ORIGINS) {
            buffer.push(this._encode(newsArticleOptions))
        }
        return buffer
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
        if (this._serverVersion < MIN_SERVER_VER.REQ_HISTORICAL_NEWS) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support historical news request.')
        }

        let buffer = [this._encode(OUTGOING.REQ_HISTORICAL_NEWS),
            this._encode(reqId),
            this._encode(conId),
            this._encode(providerCode),
            this._encode(startDateTime),
            this._encode(endDateTime),
            this._encode(totalResults),
            this._encode(historicalNewsOptions)
        ]

        if (this._serverVersion >= MIN_SERVER_VER.NEWS_QUERY_ORIGINS) {
            buffer.push(this._encode(historicalNewsOptions))
        }

        return buffer
    }

    reqHistogramData(reqId, contract, useRTH, timePeriod) {
        if (this._serverVersion < MIN_SERVER_VER.REQ_HISTOGRAM) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support histogram requests.')
        }
        return [
            this._encode(OUTGOING.REQ_HISTOGRAM_DATA),
            this._encode(reqId), 
            this._encode(contract), 
            this._encode(useRTH ? 1 : 0), 
            this._encode( timePeriod)
        ]
    }

    cancelHistogramData(reqId) {
        if (this._serverVersion < MIN_SERVER_VER.REQ_HISTOGRAM) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support head time stamp requests.')
        }
        return [
            this._encode(OUTGOING.CANCEL_HISTOGRAM_DATA),
            this._encode(reqId)
        ]
    }

    reqMarketRule(marketRuleId) {
        if (this._serverVersion < MIN_SERVER_VER.MARKET_RULES) {
            return this._emitError(BROKER_ERRORS.NO_VALID_ID, BROKER_ERRORS.UPDATE_TWS,'It does not support market rule requests.')
        }
        return [
            this._encode(OUTGOING.REQ_MARKET_RULE),
            this._encode(marketRuleId)
        ]
    }

    reqPnL(reqId, account, modelCode) {
        if (this._serverVersion < MIN_SERVER_VER.PNL) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support PnL requests.')
        }
        return [
            this._encode( OUTGOING.REQ_PNL),
            this._encode( reqId),
            this._encode(account), this._encode(modelCode)
        ]
    }

    cancelPnL(reqId) {
        if (this._serverVersion < MIN_SERVER_VER.PNL) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support PnL requests.')
        }
        return [
            this._encode(OUTGOING.CANCEL_PNL),
            this._encode(reqId)
        ]
    }

    reqPnLSingle(reqId, account, modelCode, conId) {
        if (this._serverVersion < MIN_SERVER_VER.PNL) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support PnL requests.')
        }
        return [
            this._encode(OUTGOING.REQ_PNL_SINGLE),
            this._encode(reqId),
            this._encode(account),
            this._encode( modelCode),
            this._encode( conId)
        ]
    }

    cancelPnLSingle(reqId) {
        if (this._serverVersion < MIN_SERVER_VER.PNL) {
            return this._emitError(reqId, BROKER_ERRORS.UPDATE_TWS,'It does not support PnL requests.')
        }
        return [
            this._encode(OUTGOING.CANCEL_PNL_SINGLE),
            this._encode(reqId)
        ]
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
        if (this._serverVersion < MIN_SERVER_VER.HISTORICAL_TICKS) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support historical ticks request.')
        }
        let buffer = [this._encode(OUTGOING.REQ_HISTORICAL_TICKS), this._encode(tickerId)]
  
        buffer.push(this._encode(contract.conId))
        buffer.push(this._encode(contract.symbol))
        buffer.push(this._encode(contract.secType))
        buffer.push(this._encode(contract.expiry))
        buffer.push(this._encode(contract.strike))
        buffer.push(this._encode(contract.right))
        buffer.push(this._encode(contract.multiplier))
        buffer.push(this._encode(contract.exchange))
        buffer.push(this._encode(contract.primaryExch))
        buffer.push(this._encode(contract.currency))
        buffer.push(this._encode(contract.localSymbol))
        buffer.push(this._encode(contract.tradingClass))
        buffer.push(this._encode(contract.includeExpired))
        buffer.push(this._encode(startDateTime))
        buffer.push(this._encode(endDateTime))
        buffer.push(this._encode(numberOfTicks))
        buffer.push(this._encode(whatToShow))
        buffer.push(this._encode(useRTH))
        buffer.push(this._encode(ignoreSize))
        buffer.push(this._encode(miscOptions))

        return buffer
    }

    reqTickByTickData(tickerId, contract, tickType, numberOfTicks, ignoreSize) {
        if (this._serverVersion < MIN_SERVER_VER.TICK_BY_TICK) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support tick-by-tick data requests.')
        }

        if (this._serverVersion < MIN_SERVER_VER.TICK_BY_TICK_IGNORE_SIZE) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support ignoreSize and numberOfTicks parameters in tick-by-tick data requests.')
        }

        let buffer = [this._encode(OUTGOING.REQ_TICK_BY_TICK_DATA), this._encode(tickerId)]
        // send contract fields
        buffer.push(this._encode(contract.conId))
        buffer.push(this._encode(contract.symbol))
        buffer.push(this._encode(contract.secType))
        buffer.push(this._encode(contract.expiry))
        buffer.push(this._encode(contract.strike))
        buffer.push(this._encode(contract.right))
        buffer.push(this._encode(contract.multiplier))
        buffer.push(this._encode(contract.exchange))
        buffer.push(this._encode(contract.primaryExch))
        buffer.push(this._encode(contract.currency))
        buffer.push(this._encode(contract.localSymbol))
        buffer.push(this._encode(contract.tradingClass))
        buffer.push(this._encode(tickType))

        if (this._serverVersion > MIN_SERVER_VER.TICK_BY_TICK_IGNORE_SIZE){
            buffer.push(this._encode(numberOfTicks))
            buffer.push(this._encode(ignoreSize))
        }

        return buffer
    }

    cancelTickByTickData(tickerId) {
        if (this._serverVersion < MIN_SERVER_VER.TICK_BY_TICK) {
            return this._emitError(tickerId, BROKER_ERRORS.UPDATE_TWS,'It does not support tick-by-tick data cancels.')
        }
        return [this._encode(OUTGOING.CANCEL_TICK_BY_TICK_DATA), this._encode(tickerId)]
    }
}
export default MessageEncoder
