<script lang="ts" setup>
import { isCosmosWalletInstalled, Wallet } from '@injectivelabs/wallet-ts'
import { WalletConnectStatus } from '@/types'

const walletStore = useWalletStore()
const { success } = useNotifications()
const { $onError } = useNuxtApp()
const { t } = useLang()

const isWalletInstalled = isCosmosWalletInstalled(Wallet.Leap)
const downloadLeapLink = ref<any>(null)

function connect () {
  if (isWalletInstalled) {
    walletStore
      .connectLeap()
      .then(() => {
        success({ title: t('connect.successfullyConnected') })
      })
      .catch(e => {
        walletStore.setWalletConnectStatus(WalletConnectStatus.disconnected)
        $onError(e)
      })
  } else if (downloadLeapLink.value && downloadLeapLink.value.$el) {
    downloadLeapLink.value.$el.click()
  }
}
</script>

<template>
  <LayoutWalletConnectWrapper @click="connect">
    <template #logo>
      <BaseIcon name="wallet/leap" class="w-8 h-8" />
    </template>

    <template #title>
      {{ $t('connect.leap') }}
    </template>

    <template #description>
      <span data-cy="connect-wallet-popup-ledger-button">
        {{ $t('connect.connectUsingBrowser') }}
      </span>
    </template>

    <template v-if="!isWalletInstalled" #icon>
      <NuxtLink
        ref="downloadLeapLink"
        to="https://www.leapwallet.io/downloads"
        target="_blank"
        rel="noreferrer"
      >
        <BaseIcon name="download" class="h-5 w-5 hover:text-qwerty-primary" />
      </NuxtLink>
    </template>
  </LayoutWalletConnectWrapper>
</template>
