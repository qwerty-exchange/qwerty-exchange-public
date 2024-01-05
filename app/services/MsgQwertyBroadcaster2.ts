import {
  TxGrpcApi,
  hexToBuff,
  SIGN_AMINO,
  hexToBase64,
  createTxRawEIP712,
  createTransaction,
  getEip712TypedData,
  createWeb3Extension,
  createTransactionWithSigners,
  IndexerGrpcTransactionApi,
  getGasPriceBasedOnMessage,
  recoverTypedSignaturePubKey,
  CosmosTxV1Beta1Tx,
  ChainGrpcAuthApi,
  TxRestApi,
  createAny
} from '@injectivelabs/sdk-ts'
import type { DirectSignResponse } from '@cosmjs/proto-signing'
import { BigNumberInBase, getStdFee } from '@injectivelabs/utils'
import {
  GeneralException,
  TransactionException
} from '@injectivelabs/exceptions'
import {
  getNetworkEndpoints,
  getNetworkInfo,
  NetworkEndpoints
} from '@injectivelabs/networks'
import { ChainId, EthereumChainId } from '@injectivelabs/ts-types'
import {
  MsgBroadcasterOptions,
  MsgBroadcasterTxOptions,
  MsgBroadcasterTxOptionsWithAddresses,
  getEthereumSignerAddress,
  getInjectiveSignerAddress,
  isCosmosWallet,
  Wallet,
  WalletDeviceType,
  UtilsWallets
} from '@injectivelabs/wallet-ts'
import { EthSignType } from '@keplr-wallet/types'
import { CosmosCryptoSecp256k1Keys } from '@injectivelabs/core-proto-ts'

/**
 * This class is used to broadcast transactions
 * using the WalletStrategy as a handler
 * for the sign/broadcast flow of the transactions
 *
 * Mainly used for building UI products
 */
export class MsgQwertyBroadcaster2 {
  public txService = 'https://hammerhead-app-2-9urh6.ondigitalocean.app'
  public options: MsgBroadcasterOptions

  public endpoints: NetworkEndpoints

  public chainId: ChainId

  public ethereumChainId?: EthereumChainId

  /**
   * Used to interact with the Web3Gateway service
   * to provide feeDelegation support for executing
   * transactions
   */
  public transactionApi: IndexerGrpcTransactionApi

  constructor (options: MsgBroadcasterOptions) {
    const networkInfo = getNetworkInfo(options.network)
    const endpoints =
      options.networkEndpoints || getNetworkEndpoints(options.network)

    this.options = options
    this.chainId = networkInfo.chainId
    this.ethereumChainId = networkInfo.ethereumChainId
    this.endpoints = endpoints
    this.transactionApi = new IndexerGrpcTransactionApi(endpoints.indexer)
  }

  /**
   * Broadcasting the transaction using the client
   * side approach for both cosmos and ethereum native wallets
   *
   * @param tx
   * @returns {string} transaction hash
   */
  broadcast (tx: MsgBroadcasterTxOptions) {
    const { options } = this
    const { walletStrategy } = options
    const txWithAddresses = {
      ...tx,
      ethereumAddress: getEthereumSignerAddress(
        tx.injectiveAddress || tx.address
      ),
      injectiveAddress: getInjectiveSignerAddress(
        tx.injectiveAddress || tx.address
      )
    } as MsgBroadcasterTxOptionsWithAddresses

    return isCosmosWallet(walletStrategy.wallet)
      ? this.broadcastCosmos(txWithAddresses)
      : this.broadcastWeb3(txWithAddresses)
  }

  /**
   * Prepare/sign/broadcast transaction using
   * Ethereum native wallets on the client side.
   *
   * @param tx The transaction that needs to be broadcasted
   * @returns transaction hash
   */
  private async broadcastWeb3 (tx: MsgBroadcasterTxOptionsWithAddresses) {
    const { options, endpoints, chainId, ethereumChainId } = this
    const { walletStrategy } = options
    const msgs = (Array.isArray(tx.msgs) ? tx.msgs : [tx.msgs]) as any

    if (!ethereumChainId) {
      throw new GeneralException(new Error('Please provide ethereumChainId'))
    }

    /** Account Details * */
    const chainRestAuthApi = new ChainGrpcAuthApi(endpoints.grpc)
    const accountDetailsResponse = await chainRestAuthApi.fetchAccount(
      tx.injectiveAddress
    )
    const accountDetails = accountDetailsResponse.baseAccount

    /** Block Details */
    // const chainRestTendermintApi = new ChainRestTendermintApi(endpoints.rest)
    // const latestBlock = await chainRestTendermintApi.fetchLatestBlock()
    // const latestHeight = latestBlock.header.height
    // let timeoutHeight = new BigNumberInBase(latestHeight).plus(
    //   DEFAULT_BLOCK_TIMEOUT_HEIGHT
    // )
    const timeoutHeight = new BigNumberInBase(999999999)

    const gas = (tx.gasLimit || getGasPriceBasedOnMessage(msgs)).toString()

    /** EIP712 for signing on Ethereum wallets */
    const eip712TypedData = getEip712TypedData({
      msgs,
      fee: {
        feePayer: 'inj1mevf00n7gkq25rh0sma3fm9srt22fcx6w95m7w',
        ...getStdFee(gas)
      },
      tx: {
        accountNumber: accountDetails.accountNumber.toString(),
        sequence: accountDetails.sequence.toString(),
        timeoutHeight: timeoutHeight.toFixed(),
        memo: tx.memo,
        chainId
      },
      ethereumChainId
    })

    /** Signing on Ethereum */
    const signature = (await walletStrategy.signEip712TypedData(
      JSON.stringify(eip712TypedData),
      tx.ethereumAddress
    )) as string
    const signatureBuff = hexToBuff(signature)

    /** Get Public Key of the signer */
    const publicKeyHex = recoverTypedSignaturePubKey(eip712TypedData, signature)
    const publicKeyBase64 = hexToBase64(publicKeyHex)

    /** Preparing the transaction for client broadcasting */
    const { txRaw } = createTransaction({
      message: msgs,
      memo: tx.memo,
      signMode: SIGN_AMINO,
      fee: getStdFee(gas),
      pubKey: publicKeyBase64,
      sequence: accountDetails.sequence,
      timeoutHeight: timeoutHeight.toNumber(),
      accountNumber: accountDetails.accountNumber,
      chainId
    })

    const web3Extension = createWeb3Extension({
      ethereumChainId,
      feePayer: 'inj1mevf00n7gkq25rh0sma3fm9srt22fcx6w95m7w',
      feePayerSig: Buffer.from(JSON.stringify(eip712TypedData))
    })
    const txRawEip712 = createTxRawEIP712(txRaw, web3Extension)

    /* Simulate Transaction */
    if (options.simulateTx) {
      await MsgQwertyBroadcaster2.simulate({
        txRaw,
        txClient: new TxGrpcApi(endpoints.grpc)
      })
    }

    /** Append Signatures */
    txRawEip712.signatures = [signatureBuff]

    /** Broadcast the transaction */
    const txApi = new TxRestApi(this.txService)
    const response = await txApi.broadcastBlock(txRaw)

    return response
  }

  /**
   * Prepare/sign/broadcast transaction using
   * Cosmos native wallets on the client side.
   *
   * @param tx The transaction that needs to be broadcasted
   * @returns transaction hash
   */
  private async broadcastCosmos (tx: MsgBroadcasterTxOptionsWithAddresses) {
    const { options, endpoints, chainId } = this
    const { walletStrategy } = options
    const msgs = (Array.isArray(tx.msgs) ? tx.msgs : [tx.msgs]) as any

    /**
     * When using Ledger with Keplr we have
     * to send EIP712 to sign on Keplr
     */
    if (walletStrategy.getWallet() === Wallet.Keplr) {
      const walletDeviceType = await walletStrategy.getWalletDeviceType()
      const isLedgerConnectedOnKeplr =
        walletDeviceType === WalletDeviceType.Hardware

      if (isLedgerConnectedOnKeplr) {
        return this.experimentalBroadcastKeplrWithLedger(tx)
      }
    }

    const chainRestAuthApi = new ChainGrpcAuthApi(endpoints.grpc)
    const accountDetailsResponse = await chainRestAuthApi.fetchAccount(
      tx.injectiveAddress
    )
    const accountDetails = accountDetailsResponse.baseAccount

    /** Block Details */
    // const chainRestTendermintApi = new ChainRestTendermintApi(endpoints.rest)
    // const latestBlock = await chainRestTendermintApi.fetchLatestBlock()
    // const latestHeight = latestBlock.header.height
    // let timeoutHeight = new BigNumberInBase(latestHeight).plus(
    //   DEFAULT_BLOCK_TIMEOUT_HEIGHT
    // )
    const timeoutHeight = new BigNumberInBase(999999999)

    const pubKey = await walletStrategy.getPubKey()
    const gas = (tx.gasLimit || getGasPriceBasedOnMessage(msgs)).toString()

    const keyProto = CosmosCryptoSecp256k1Keys.PubKey.create({
      key: Buffer.from('Al61J56a1nfnP+C8gIkq31m18gQqb5CS0Sws60eMTsB+', 'base64')
    })

    const pubKeyFee = createAny(
      CosmosCryptoSecp256k1Keys.PubKey.encode(keyProto).finish(),
      '/cosmos.crypto.secp256k1.PubKey'
    )

    /** Prepare the Transaction * */
    const { txRaw } = createTransactionWithSigners({
      chainId,
      memo: tx.memo,
      message: msgs,
      timeoutHeight: timeoutHeight.toNumber(),
      signers: [
        {
          pubKey,
          accountNumber: accountDetails.accountNumber,
          sequence: accountDetails.sequence
        },
        {
          pubKey: pubKeyFee,
          accountNumber: 21642,
          sequence: 1
        }
      ],
      fee: {
        ...getStdFee(gas),
        payer: 'inj14wp0pj2ty55kmvu7xpz7glask7tvpf5anss9ay'
      }
    })

    /* Simulate Transaction */
    if (options.simulateTx) {
      await MsgQwertyBroadcaster2.simulate({
        txRaw,
        txClient: new TxGrpcApi(endpoints.grpc)
      })
    }

    const directSignResponse = (await walletStrategy.signCosmosTransaction({
      txRaw,
      chainId,
      address: tx.injectiveAddress,
      accountNumber: accountDetails.accountNumber
    })) as DirectSignResponse

    // return walletStrategy.sendTransaction(directSignResponse, {
    //   chainId,
    //   address: tx.injectiveAddress
    // })

    txRaw.authInfoBytes = directSignResponse.signed.authInfoBytes
    txRaw.bodyBytes = directSignResponse.signed.bodyBytes
    txRaw.signatures = [
      Buffer.from(directSignResponse.signature.signature, 'base64')
    ]

    const txApi = new TxRestApi(this.txService)
    const response = await txApi.broadcastBlock(txRaw)

    return response
  }

  /**
   * We use this method only when we want to broadcast a transaction using Ledger on Keplr for Injective
   *
   * @param tx the transaction that needs to be broadcasted
   */
  private async experimentalBroadcastKeplrWithLedger (
    tx: MsgBroadcasterTxOptionsWithAddresses
  ) {
    const { options, endpoints, chainId, ethereumChainId } = this
    const { walletStrategy } = options
    const msgs = (Array.isArray(tx.msgs) ? tx.msgs : [tx.msgs]) as any

    /**
     * We can only use this method when Keplr is connected
     * with ledger
     */
    if (walletStrategy.getWallet() === Wallet.Keplr) {
      const walletDeviceType = await walletStrategy.getWalletDeviceType()
      const isLedgerConnectedOnKeplr =
        walletDeviceType === WalletDeviceType.Hardware

      if (!isLedgerConnectedOnKeplr) {
        throw new GeneralException(
          new Error(
            'This method can only be used when Keplr is connected with Ledger'
          )
        )
      }
    }

    if (!ethereumChainId) {
      throw new GeneralException(new Error('Please provide ethereumChainId'))
    }

    const keplrWallet = new UtilsWallets.KeplrWallet(chainId)
    /** Account Details * */
    const chainRestAuthApi = new ChainGrpcAuthApi(endpoints.grpc)
    const accountDetailsResponse = await chainRestAuthApi.fetchAccount(
      tx.injectiveAddress
    )
    const accountDetails = accountDetailsResponse.baseAccount

    /** Block Details */
    // const chainRestTendermintApi = new ChainRestTendermintApi(endpoints.rest)
    // const latestBlock = await chainRestTendermintApi.fetchLatestBlock()
    // const latestHeight = latestBlock.header.height
    // let timeoutHeight = new BigNumberInBase(latestHeight).plus(
    //   DEFAULT_BLOCK_TIMEOUT_HEIGHT
    // )
    const timeoutHeight = new BigNumberInBase(999999999)

    const pubKey = await walletStrategy.getPubKey()
    const gas = (tx.gasLimit || getGasPriceBasedOnMessage(msgs)).toString()

    /** EIP712 for signing on Ethereum wallets */
    const eip712TypedData = getEip712TypedData({
      msgs,
      fee: {
        feePayer: 'inj1mevf00n7gkq25rh0sma3fm9srt22fcx6w95m7w',
        ...getStdFee(gas)
      },
      tx: {
        accountNumber: accountDetails.accountNumber.toString(),
        sequence: accountDetails.sequence.toString(),
        timeoutHeight: timeoutHeight.toFixed(),
        chainId
      },
      ethereumChainId
    })
    eip712TypedData.domain.chainId = '1'
    const result = await (
      await keplrWallet.getKeplrWallet()
    ).signEthereum(
      'injective-1',
      tx.injectiveAddress,
      JSON.stringify(eip712TypedData),
      EthSignType.EIP712
    )
    /**
     * Create TxRaw from the signed tx that we
     * get as a response in case the user changed the fee/memo
     * on the Keplr popup
     */
    const { txRaw } = createTransaction({
      pubKey,
      message: msgs,
      memo: eip712TypedData.message.memo,
      signMode: SIGN_AMINO,
      fee: getStdFee(gas),
      sequence: accountDetails.sequence,
      timeoutHeight: timeoutHeight.toNumber(),
      accountNumber: accountDetails.accountNumber,
      chainId
    })

    /** Preparing the transaction for client broadcasting */
    const web3Extension = createWeb3Extension({
      ethereumChainId,
      feePayer: 'inj1mevf00n7gkq25rh0sma3fm9srt22fcx6w95m7w',
      feePayerSig: Buffer.from(JSON.stringify(eip712TypedData))
    })
    const txRawEip712 = createTxRawEIP712(txRaw, web3Extension)

    /* Simulate Transaction */
    if (options.simulateTx) {
      await MsgQwertyBroadcaster2.simulate({
        txRaw,
        txClient: new TxGrpcApi(endpoints.grpc)
      })
    }

    txRawEip712.signatures = [result]

    /** Broadcast the transaction */
    const txApi = new TxRestApi(this.txService)
    const response = await txApi.broadcastBlock(txRaw)

    return response
  }

  private static async simulate ({
    txRaw,
    txClient
  }: {
    txRaw: CosmosTxV1Beta1Tx.TxRaw
    txClient: TxGrpcApi | TxRestApi
  }) {
    const txRawWithSignature = CosmosTxV1Beta1Tx.TxRaw.fromPartial({ ...txRaw })
    txRawWithSignature.signatures = [new Uint8Array(0)]

    try {
      return await txClient.simulate(txRawWithSignature)
    } catch (e) {
      if (e instanceof TransactionException) {
        throw e
      }

      throw new TransactionException(new Error((e as any).message))
    }
  }
}
