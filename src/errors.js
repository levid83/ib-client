export const BROKER_ERRORS = {
  NO_VALID_ID: -1,

  ALREADY_CONNECTED: { code: 501, message: 'Already connected.' },
  CONNECT_FAIL: {
    code: 502,
    message:
      'Couldn\'t connect to TWS. Confirm that "Enable ActiveX and Socket Clients" ' +
      'is enabled and connection port is the same as "Socket Port" on the TWS "Edit->Global Configuration...->API->Settings" menu. ' +
      'Live Trading ports: TWS: 7496; IB Gasteway: 4001. Simulated Trading ports for new installations of version 954.1 or newer: ' +
      'TWS: 7497; IB Gateway: 4002'
  },
  UPDATE_TWS: { code: 503, message: 'The TWS is out of date and must be upgraded.' },
  NOT_CONNECTED: { code: 504, message: 'Not connected' },
  UNKNOWN_ID: { code: 505, message: 'Fatal Error: Unknown message id.' },
  UNSUPPORTED_VERSION: { code: 506, message: 'Unsupported Version' },
  BAD_LENGTH: { code: 507, message: 'Bad Message Length' },
  BAD_MESSAGE: { code: 508, message: 'Bad Message' },
  FAIL_SEND: { code: 509, message: 'Failed to send message - ' }, // generic message; all future messages should use this
  FAIL_SEND_REQMKT: { code: 510, message: 'Request Market Data Sending Error - ' },
  FAIL_SEND_CANMKT: { code: 511, message: 'Cancel Market Data Sending Error - ' },
  FAIL_SEND_ORDER: { code: 512, message: 'Order Sending Error - ' },
  FAIL_SEND_ACCT: { code: 513, message: 'Account Update Request Sending Error -' },
  FAIL_SEND_EXEC: { code: 514, message: 'Request For Executions Sending Error -' },
  FAIL_SEND_CORDER: { code: 515, message: 'Cancel Order Sending Error -' },
  FAIL_SEND_OORDER: { code: 516, message: 'Request Open Order Sending Error -' },
  UNKNOWN_CONTRACT: {
    code: 517,
    message: 'Unknown contract. Verify the contract details supplied.'
  },
  FAIL_SEND_REQCONTRACT: { code: 518, message: 'Request Contract Data Sending Error - ' },
  FAIL_SEND_REQMKTDEPTH: { code: 519, message: 'Request Market Depth Sending Error - ' },
  FAIL_SEND_CANMKTDEPTH: { code: 520, message: 'Cancel Market Depth Sending Error - ' },
  FAIL_SEND_SERVER_LOG_LEVEL: { code: 521, message: 'Set Server Log Level Sending Error - ' },
  FAIL_SEND_FA_REQUEST: { code: 522, message: 'FA Information Request Sending Error - ' },
  FAIL_SEND_FA_REPLACE: { code: 523, message: 'FA Information Replace Sending Error - ' },
  FAIL_SEND_REQSCANNER: { code: 524, message: 'Request Scanner Subscription Sending Error - ' },
  FAIL_SEND_CANSCANNER: { code: 525, message: 'Cancel Scanner Subscription Sending Error - ' },
  FAIL_SEND_REQSCANNERPARAMETERS: {
    code: 526,
    message: 'Request Scanner Parameter Sending Error - '
  },
  FAIL_SEND_REQHISTDATA: { code: 527, message: 'Request Historical Data Sending Error - ' },
  FAIL_SEND_CANHISTDATA: { code: 528, message: 'Request Historical Data Sending Error - ' },
  FAIL_SEND_REQRTBARS: { code: 529, message: 'Request Real-time Bar Data Sending Error - ' },
  FAIL_SEND_CANRTBARS: { code: 530, message: 'Cancel Real-time Bar Data Sending Error - ' },
  FAIL_SEND_REQCURRTIME: { code: 531, message: 'Request Current Time Sending Error - ' },
  FAIL_SEND_REQFUNDDATA: { code: 532, message: 'Request Fundamental Data Sending Error - ' },
  FAIL_SEND_CANFUNDDATA: { code: 533, message: 'Cancel Fundamental Data Sending Error - ' },
  FAIL_SEND_REQCALCIMPLIEDVOLAT: {
    code: 534,
    message: 'Request Calculate Implied Volatility Sending Error - '
  },
  FAIL_SEND_REQCALCOPTIONPRICE: {
    code: 535,
    message: 'Request Calculate Option Price Sending Error - '
  },
  FAIL_SEND_CANCALCIMPLIEDVOLAT: {
    code: 536,
    message: 'Cancel Calculate Implied Volatility Sending Error - '
  },
  FAIL_SEND_CANCALCOPTIONPRICE: {
    code: 537,
    message: 'Cancel Calculate Option Price Sending Error - '
  },
  FAIL_SEND_REQGLOBALCANCEL: { code: 538, message: 'Request Global Cancel Sending Error - ' },
  FAIL_SEND_REQMARKETDATATYPE: { code: 539, message: 'Request Market Data Type Sending Error - ' },
  FAIL_SEND_REQPOSITIONS: { code: 540, message: 'Request Positions Sending Error - ' },
  FAIL_SEND_CANPOSITIONS: { code: 541, message: 'Cancel Positions Sending Error - ' },
  FAIL_SEND_REQACCOUNTDATA: { code: 542, message: 'Request Account Data Sending Error - ' },
  FAIL_SEND_CANACCOUNTDATA: { code: 543, message: 'Cancel Account Data Sending Error - ' },
  FAIL_SEND_VERIFYREQUEST: { code: 544, message: 'Verify Request Sending Error - ' },
  FAIL_SEND_VERIFYMESSAGE: { code: 545, message: 'Verify Message Sending Error - ' },
  FAIL_SEND_QUERYDISPLAYGROUPS: { code: 546, message: 'Query Display Groups Sending Error - ' },
  FAIL_SEND_SUBSCRIBETOGROUPEVENTS: {
    code: 547,
    message: 'Subscribe To Group Events Sending Error - '
  },
  FAIL_SEND_UPDATEDISPLAYGROUP: { code: 548, message: 'Update Display Group Sending Error - ' },
  FAIL_SEND_UNSUBSCRIBEFROMGROUPEVENTS: {
    code: 549,
    message: 'Unsubscribe From Group Events Sending Error - '
  },
  FAIL_SEND_STARTAPI: { code: 550, message: 'Start API Sending Error - ' },
  FAIL_SEND_VERIFYANDAUTHREQUEST: {
    code: 551,
    message: 'Verify And Auth Request Sending Error - '
  },
  FAIL_SEND_VERIFYANDAUTHMESSAGE: {
    code: 552,
    message: 'Verify And Auth Message Sending Error - '
  },
  FAIL_SEND_REQPOSITIONSMULTI: { code: 553, message: 'Request Positions Multi Sending Error - ' },
  FAIL_SEND_CANPOSITIONSMULTI: { code: 554, message: 'Cancel Positions Multi Sending Error - ' },
  FAIL_SEND_REQACCOUNTUPDATESMULTI: {
    code: 555,
    message: 'Request Account Updates Multi Sending Error - '
  },
  FAIL_SEND_CANACCOUNTUPDATESMULTI: {
    code: 556,
    message: 'Cancel Account Updates Multi Sending Error - '
  },
  FAIL_SEND_REQSECDEFOPTPARAMS: {
    code: 557,
    message: 'Request Security Definition Option Params Sending Error - '
  },
  FAIL_SEND_REQSOFTDOLLARTIERS: {
    code: 558,
    message: 'Request Soft Dollar Tiers Sending Error - '
  },
  FAIL_SEND_REQFAMILYCODES: { code: 559, message: 'Request Family Codes Sending Error - ' },
  FAIL_SEND_REQMATCHINGSYMBOLS: { code: 560, message: 'Request Matching Symbols Sending Error - ' },
  FAIL_SEND_REQMKTDEPTHEXCHANGES: {
    code: 561,
    message: 'Request Market Depth Exchanges Sending Error - '
  },
  FAIL_SEND_REQSMARTCOMPONENTS: { code: 562, message: 'Request Smart Components Sending Error - ' },
  FAIL_SEND_REQNEWSPROVIDERS: { code: 563, message: 'Request News Providers Sending Error - ' },
  FAIL_SEND_REQNEWSARTICLE: { code: 564, message: 'Request News Article Sending Error - ' },
  FAIL_SEND_REQHISTORICALNEWS: { code: 565, message: 'Request Historical News Sending Error - ' },
  FAIL_SEND_REQHEADTIMESTAMP: { code: 566, message: 'Request Head Time Stamp Sending Error - ' },
  FAIL_SEND_CANHEADTIMESTAMP: { code: 567, message: 'Cancel Head Time Stamp Sending Error - ' },
  FAIL_SEND_REQMARKETRULE: { code: 568, message: 'Request Market Rule Sending Error - ' },
  FAIL_SEND_REQPNL: { code: 566, message: 'Request PnL Sending Error - ' },
  FAIL_SEND_CANPNL: { code: 567, message: 'Cancel PnL Sending Error - ' },
  FAIL_SEND_REQPNL_SINGLE: { code: 568, message: 'Request PnL Single Sending Error - ' },
  FAIL_SEND_CANPNL_SINGLE: { code: 569, message: 'Cancel PnL Single Sending Error - ' },
  FAIL_SEND_HISTORICAL_TICK: { code: 569, message: 'Request Historical Ticks Sending Error - ' },
  FAIL_SEND_REQTICKBYTICK: { code: 570, message: 'Request Tick-By-Tick Sending Error - ' },
  FAIL_SEND_CANTICKBYTICK: { code: 571, message: 'Cancel Tick-By-Tick Sending Error - ' }
}

export class BrokerError extends Error {
  constructor(error) {
    super(error.message)
    this.code = error.code || null
    this.id = error.id || -1
  }
}

export class UnderrunError extends Error {
  constructor(message) {
    super()
    this.name = 'UnderrunError'
    this.message = message || 'An underrun error has occurred'
    this.stack = new Error().stack
  }
}
