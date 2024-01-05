<script lang="ts" setup>
import VueQrcode from '@chenfengyuan/vue-qrcode'
import { Status, StatusType } from '@injectivelabs/utils'
import { Modal } from '@/types'
import { msgBroadcastClient } from '~/app/Services'

const modalStore = useModalStore()

const isModalOpen = computed(() => modalStore.modals[Modal.Mobile])

const status = reactive(new Status(StatusType.Idle))

const walletStore = useWalletStore()

const form = reactive({
  token: ''
})

const { t } = useLang()

const { $onError } = useNuxtApp()
const { success } = useNotifications()

watch(isModalOpen, () => {
  form.token = ''
  status.setIdle()
})

async function handleConfirm() {
  status.setLoading()
  try {
    const account = await msgBroadcastClient.createAccount(31556926) // 1 year
    form.token = `${walletStore.injectiveAddress}:${account.token}:${account.tokenExpiry}`
  } catch {
  } finally {
    status.setIdle()
  }
}

function handleClose() {
  form.token = ''
  status.setIdle()
  modalStore.closeModal(Modal.Mobile)
}
</script>

<template>
  <AppModal
    :show="isModalOpen"
    :is-always-open="true"
    @modal:closed="handleClose"
    sm
  >
    <template #title>Connect mobile app</template>
    <div class="text-center pb-2">
      <p class="text-lg">Scan QR code to connect device</p>
      <div v-if="form.token" class="flex items-center justify-center mt-4 mb-6">
        <div class="rounded-xl overflow-hidden">
          <VueQrcode :value="form.token" :options="{ width: 150 }"></VueQrcode>
        </div>
      </div>
      <div v-else class="flex items-center justify-center">
        <div
          class="w-[150px] h-[150px] relative overflow-hidden mt-4 mb-6 flex justify-center items-center"
        >
          <div class="rounded-xl overflow-hidden">
            <div class="blur-sm">
              <VueQrcode :value="'qwerty.exchange'" :options="{ width: 150 }" />
            </div>
          </div>
          <div
            class="absolute inset-0 bg-qwerty-shade3 border rounded-xl opacity-95"
          >
            <AppButton
              v-if="!form.token"
              :status="status"
              class="rounded-lg h-full w-full bg-transparent font-medium flex justify-center items-center text-white hover:text-qwerty-primary"
              primary
              @click="handleConfirm"
            >
              <BaseIcon name="rotate" class="w-[28px] duration-200" />
            </AppButton>
          </div>
        </div>
      </div>

      <p class="border-b border-qwerty-shade3 pb-2">Warning!</p>
      <p class="text-sm text-qwerty-secondary2 pt-2 px-4">
        Do not share the above QR code with anyone, it allows you to transact
        from your account.
      </p>
    </div>
  </AppModal>
</template>
