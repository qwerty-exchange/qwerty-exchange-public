<script lang="ts" setup>
import { Modal } from '~~/types'

const walletStore = useWalletStore()
const signModeType = computed(() => walletStore.signMode)
const expiry = computed(() => new Date(walletStore.sso.tokenExpiry - 12000))

const modalStore = useModalStore()
function handleClickSignModeChange() {
  modalStore.openModal({
    type: Modal.Signin,
    data: { context: 'change-mode' }
  })
}
</script>

<template>
  <div class="border-t border-qwerty-shade3"></div>
  <div v-if="true" class="py-2 text-qwerty-white">
    <div class="flex items-start justify-between">
      <h3 class="text-sm font-medium">
        {{ $t('Sign mode') }}
      </h3>
      <span
        class="text-sm font-medium text-qwerty-primary cursor-pointer"
        data-cy="wallet-connected-popper-disconnect-button"
        @click="handleClickSignModeChange"
        >{{ $t('Change Sign Mode') }}
      </span>
    </div>
    <div vclass="flex items-start justify-between">
      <span
        class="text-sm font-medium text-qwerty-secondary2 pt-4 pb-2"
        data-cy="wallet-connected-popper-disconnect-button"
      >
        <template v-if="signModeType === 'classic'">
          Sign manually every transaction
        </template>
        <template v-if="signModeType === 'modern' && expiry > new Date()">
          Signing by token until {{ expiry.toTimeString().slice(0, 8) }}
        </template>
        <template v-if="signModeType === 'modern' && expiry <= new Date()">
          <span class="text-qwerty-red">Token has expired</span>
        </template>
      </span>
    </div>
  </div>
</template>
