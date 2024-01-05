import {
  ChainGrpcAuthApi,
  createAny,
  createTransactionWithSigners,
  getGasPriceBasedOnMessage,
  getInjectiveAddress,
  MsgAuthzExec,
  MsgGrant,
  PrivateKey,
  TxResponse,
  TxRestApi
} from '@injectivelabs/sdk-ts'
import { BigNumberInBase, getStdFee } from '@injectivelabs/utils'
import {
  MsgBroadcaster,
  MsgBroadcasterTxOptions
} from '@injectivelabs/wallet-ts'
import { CosmosCryptoSecp256k1Keys } from '@injectivelabs/core-proto-ts'
import { indexerExplorerApi } from '../Services'
import { TokenAccountService } from './TokenAccountService'
import { Modal } from '~~/types'

export class TokenSignClient {
  msgBroadcaster: MsgBroadcaster
  tokenAccountService: TokenAccountService

  constructor (msgBroadcaster: MsgBroadcaster) {
    this.msgBroadcaster = msgBroadcaster
    this.tokenAccountService = new TokenAccountService()
  }

  async broadcastModern (
    mode: string,
    tx: MsgBroadcasterTxOptions
  ): Promise<TxResponse> {
    const accountStore = useAccountStore()
    const walletStore = useWalletStore()
    if (mode === 'Wallet' || !accountStore.hasEnoughInjForGas) {
      return (await this.broadcastByByWallet(tx)) as any
    }

    const blockChainTime = await this.getBlockChainTime()

    if (walletStore.signMode === 'classic') {
      return (await this.broadcastByByWallet(tx)) as any
    }

    if (
      walletStore.signMode === 'modern' &&
      walletStore.sso.tokenExpiry! > blockChainTime.getTime()
    ) {
      return await this.broadcastByToken(tx)
    }

    // if (walletStore.signMode === 'classic') {
    //   this.app.$accessor.app.updateSignModePropositionTimestamp(
    //     blockChainTime.getTime()
    //   )
    // }
    const modalStore = useModalStore()
    await new Promise((resolve, reject) =>
      modalStore.openModal({
        type: Modal.Signin,
        data: {
          context: walletStore.signMode === 'classic' ? 'try-mode' : 'time-off',
          onResult: (result: any) => {
            resolve(result.type)
          },
          onReject: reject
        }
      })
    )

    if (
      walletStore.signMode !== 'modern' ||
      walletStore.sso.tokenExpiry! < blockChainTime.getTime()
    ) {
      return (await this.broadcastByByWallet(tx)) as any
    }

    return await this.broadcastByToken(tx)
  }

  async broadcastByByWallet (tx: MsgBroadcasterTxOptions) {
    const walletStore = useWalletStore()
    await walletStore.validate()
    return await this.msgBroadcaster.broadcast(tx)
  }

  async broadcastByToken (transaction: MsgBroadcasterTxOptions) {
    const { chainId, endpoints } = this.msgBroadcaster
    const walletStore = useWalletStore()
    const privateKey = PrivateKey.fromHex(walletStore.sso.token)
    const address = privateKey.toAddress()

    const msgs = (
      Array.isArray(transaction.msgs) ? transaction.msgs : [transaction.msgs]
    ) as any

    const tx = {
      ...transaction,
      msgs,
      ethereumAddress: address.getEthereumAddress(),
      injectiveAddress: address.bech32Address
    } as MsgBroadcasterTxOptions

    /** Account Details * */
    const publicKey = privateKey.toPublicKey()
    const chainRestAuthApi = new ChainGrpcAuthApi(endpoints.grpc)
    const accountDetailsResponse = await chainRestAuthApi.fetchAccount(
      tx.injectiveAddress!
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

    const grantMsg = new MsgAuthzExec({
      grantee: tx.injectiveAddress!,
      msgs: tx.msgs as any
    })

    const keyProto = CosmosCryptoSecp256k1Keys.PubKey.create({
      key: Buffer.from('Al61J56a1nfnP+C8gIkq31m18gQqb5CS0Sws60eMTsB+', 'base64')
    })

    const pubKeyFee = createAny(
      CosmosCryptoSecp256k1Keys.PubKey.encode(keyProto).finish(),
      '/cosmos.crypto.secp256k1.PubKey'
    )

    const gas = (
      transaction.gasLimit || getGasPriceBasedOnMessage([grantMsg])
    ).toString()

    /** Prepare the Transaction * */
    const { signBytes, txRaw } = createTransactionWithSigners({
      memo: 'QWERTY',
      fee: {
        ...getStdFee(gas),
        payer: 'inj14wp0pj2ty55kmvu7xpz7glask7tvpf5anss9ay'
      },
      message: grantMsg,
      timeoutHeight: timeoutHeight.toNumber(),
      signers: [
        {
          pubKey: publicKey.toBase64(),
          accountNumber: accountDetails.accountNumber,
          sequence: accountDetails.sequence
        },
        {
          pubKey: pubKeyFee,
          accountNumber: 21642,
          sequence: 1
        }
      ],
      chainId
    })

    /** Sign transaction */
    const signature = await privateKey.sign(Buffer.from(signBytes))

    /** Append Signatures */
    txRaw.signatures = [signature]

    /** Broadcast transaction */
    const txApi = new TxRestApi(
      'https://hammerhead-app-2-9urh6.ondigitalocean.app'
    )
    const txResponse = await txApi.broadcastBlock(txRaw)

    return txResponse
  }

  async createAccount (timeLife: number) {
    const lists = [
      '/injective.exchange.v1beta1.MsgBatchCancelDerivativeOrders',
      '/injective.exchange.v1beta1.MsgBatchCancelSpotOrders',
      '/injective.exchange.v1beta1.MsgCancelDerivativeOrder',
      '/injective.exchange.v1beta1.MsgCancelSpotOrder',
      '/injective.exchange.v1beta1.MsgCreateDerivativeLimitOrder',
      '/injective.exchange.v1beta1.MsgCreateDerivativeMarketOrder',
      '/injective.exchange.v1beta1.MsgCreateSpotLimitOrder',
      '/injective.exchange.v1beta1.MsgCreateSpotMarketOrder',
      '/injective.exchange.v1beta1.MsgDeposit',
      '/injective.exchange.v1beta1.MsgIncreasePositionMargin',
      '/injective.exchange.v1beta1.MsgWithdraw',
      '/injective.exchange.v1beta1.MsgBatchUpdateOrders',
      '/injective.exchange.v1beta1.MsgCreateBinaryOptionsLimitOrder',
      '/injective.exchange.v1beta1.MsgCreateBinaryOptionsMarketOrder',
      '/injective.exchange.v1beta1.MsgCancelBinaryOptionsOrder',
      '/injective.exchange.v1beta1.MsgBatchCancelBinaryOptionsOrders'
    ]
    const blockChainTime = await this.getBlockChainTime()
    const expiry = timeLife * 1000 + blockChainTime.getTime()

    const account = this.tokenAccountService.createAccount()
    const injectiveAddress = account.injectiveAddress
    const walletStore = useWalletStore()
    await walletStore.validate()

    await this.msgBroadcaster.broadcast({
      msgs: [
        ...lists.map(
          x =>
            new MsgGrant({
              grantee: injectiveAddress,
              granter: getInjectiveAddress(walletStore.address),
              messageType: x,
              expiration: Math.round(Number(expiry / 1000)) + 120
            })
        )
      ] as any,
      memo: 'QWERTY',
      address: walletStore.address
    })
    return { token: account.token, tokenExpiry: expiry }
  }

  async getBlockChainTime () {
    const blocks = await indexerExplorerApi.fetchBlocks({ limit: 1 })
    return new Date(Date.parse(blocks.data[0].timestamp))
  }

  logout () {
    // this.app.$accessor.wallet.setSignMode({ mode: 'classic' })
  }
}
