// import Web3 from 'web3'
import { PrivateKey } from '@injectivelabs/sdk-ts'
import { localStorage } from '@/app/Services'

export class TokenAccountService {
  createAccount () {
    const array = new Uint8Array(32)
    const privateKey = Buffer.from(crypto.getRandomValues(array)).toString(
      'hex'
    )

    return {
      ...this.getAccount(privateKey)!,
      token: privateKey
    }
  }

  getAccount (token: string) {
    if (token == null) {
      return null
    }
    const privateKey = PrivateKey.fromHex(token)

    const publicKey = Buffer.from(
      privateKey.toPublicKey().toPubKeyBytes()
    ).toString('base64')
    const injectiveAddress = privateKey.toBech32()

    return {
      injectiveAddress,
      publicKey,
      expiry: localStorage.get('account-expiry')
    }
  }

  async sign (token: string, message: any): Promise<Uint8Array> {
    if (token == null) {
      throw new Error("Private key isn't contains")
    }
    const privateKey = PrivateKey.fromHex(token)
    const signature = await privateKey.sign(message)

    return signature
  }
}
