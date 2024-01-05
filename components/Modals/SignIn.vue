<script lang="ts" setup>
import { Status, StatusType } from '@injectivelabs/utils'
import { Modal } from '@/types'

const modalStore = useModalStore()

const isModalOpen = computed(() => modalStore.modals[Modal.Signin])

const status = reactive(new Status(StatusType.Idle))

const walletStore = useWalletStore()

const modalData = computed(() => modalStore.data[Modal.Signin])

const form = reactive({ timeValue: -1 })

const { t } = useLang()

const { $onError } = useNuxtApp()
const { success } = useNotifications()

watch(isModalOpen, () => {
  form.timeValue = -1
})

function handleConfirm() {
  status.setLoading()
  const mode = form.timeValue === 0 ? 'classic' : 'modern'
  return walletStore
    .onConnect2(mode, form.timeValue * 60)
    .then(() => {
      modalStore.closeModal(Modal.Signin)
      modalData.value.onResult?.(mode)
      status.setIdle()
      success({ title: t('Success') })
    })
    .catch(e => {
      modalData.value.onReject?.('User rejected')
      status.setIdle()
      $onError(e)
    })
}
function handleChangeTimeValue($event: any) {
  form.timeValue = $event
}

function handleClose() {
  modalStore.closeModal(Modal.Signin)
}
</script>

<template>
  <AppModal
    :show="isModalOpen"
    :hide-close-button="modalData?.context !== 'change-mode'"
    :is-always-open="true"
    @modal:closed="handleClose"
    sm
  >
    <template #title></template>

    <AppHocLoading :status="status">
      <div class="relative">
        <div class="flex flex-col items-center mb-6">
          <div
            v-if="false"
            class="min-w-0 flex-1 flex rounded-lg py-4 w-full mb-1"
          >
            <div class="flex-shrink-0 mr-4">
              <BaseIcon
                :name="`wallet/${walletStore.wallet}`"
                class="h-6 w-6"
              />
            </div>
            <div
              class="min-w-0 flex-1 md:grid md:grid-cols-1 md:gap-4 text-left"
            >
              <div>
                <p class="text-xs truncate">
                  {{ walletStore.injectiveAddress }}
                </p>
                <p class="flex items-center text-xs">
                  <span
                    class="truncate"
                    data-cy="connect-wallet-popup-metamask-button"
                  >
                    {{ walletStore.address }}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div
            class="border-qwerty-shade3 min-w-0 flex-1 md:grid md:grid-cols-1 md:gap-4 text-left"
          >
            <template v-if="modalData.context === 'sign-in'">
              <div class="mb-2">
                <h4 class="text-2xl font-bold mb-2">Choose sign mode</h4>
                <p class="text-sm text-qwerty-white">
                  In order to continue, specify the time for which you want to
                  grant access to your wallet.
                </p>
                <p class="text-sm text-qwerty-white">
                  You can change your chosen at any time
                </p>
                <a
                  href="https://medium.com/@qwertyexchange/try-a-new-experience-in-web3-3a1e767e7211"
                  target="_blank"
                  class="text-sm text-qwerty-primary"
                  >Read about it more
                </a>
              </div>
            </template>
            <template v-if="modalData.context === 'change-mode'">
              <div class="mb-2">
                <h4 class="text-2xl font-bold mb-2">Change sign mode</h4>
                <p class="text-sm text-qwerty-white">
                  In order to continue, specify the time for which you want to
                  grant access to your wallet.
                </p>
                <p class="text-sm text-qwerty-white">
                  You can change your chosen at any time
                </p>
                <a
                  href="https://medium.com/@qwertyexchange/try-a-new-experience-in-web3-3a1e767e7211"
                  target="_blank"
                  class="text-sm text-qwerty-primary"
                  >Read about it more
                </a>
              </div>
            </template>
            <template v-if="modalData.context === 'try-mode'">
              <div class="mb-2">
                <h4 class="text-xl font-bold mb-2">
                  Do you want to keep signing transactions yourself?
                </h4>
                <p class="text-sm text-qwerty-white">
                  You can specify the time for which you want to grant access to
                  your wallet and try new experience.
                </p>
                <p class="text-sm text-qwerty-white">
                  You can change your chosen at any time
                </p>
                <a
                  href="https://medium.com/@qwertyexchange/try-a-new-experience-in-web3-3a1e767e7211"
                  target="_blank"
                  class="text-sm text-qwerty-primary"
                  >Read about it more
                </a>
              </div>
            </template>
            <template v-if="modalData.context === 'time-off'">
              <div class="mb-2">
                <h4 class="text-2xl font-bold mb-2 text-qwerty-red">
                  Token has expired
                </h4>
                <p class="text-sm text-qwerty-white">
                  In order to continue, specify the time for which you want to
                  grant access to your wallet.
                </p>
                <p class="text-sm text-qwerty-white">
                  You can change your chosen at any time
                </p>
                <a
                  href="https://medium.com/@qwertyexchange/try-a-new-experience-in-web3-3a1e767e7211"
                  target="_blank"
                  class="text-sm text-qwerty-primary"
                  >Read about it more
                </a>
              </div>
            </template>

            <AppRadioGroup
              :value="form.timeValue"
              @change="handleChangeTimeValue"
            >
              <template #options="{ value, setValue }">
                <div class="grid grid-cols-4 gap-4">
                  <AppRadioLabel :active="value === 30" @click="setValue(30)">
                    <template #label>
                      <span class="mb-2 block lowercase">
                        {{ $t('30 minutes') }}
                      </span>
                    </template>
                  </AppRadioLabel>
                  <AppRadioLabel :active="value === 60" @click="setValue(60)">
                    <template #label>
                      <span class="mb-2 block lowercase">
                        {{ $t('1 hour') }}
                      </span>
                    </template>
                  </AppRadioLabel>
                  <AppRadioLabel :active="value === 120" @click="setValue(120)">
                    <template #label>
                      <span class="mb-2 block lowercase">
                        {{ $t('2 hours') }}
                      </span>
                    </template>
                  </AppRadioLabel>
                  <AppRadioLabel :active="value === 480" @click="setValue(480)">
                    <template #label>
                      <span class="mb-2 block lowercase">
                        {{ $t('8 hours') }}
                      </span>
                    </template>
                  </AppRadioLabel>
                </div>
                <div class="flex">
                  <AppRadioLabel
                    :type-in="'block'"
                    :active="value === 0"
                    @click="setValue(0)"
                  >
                    <template #label>
                      <span class="mb-2 block normal-case">
                        {{ $t('I want to sign every transaction myself') }}
                      </span>
                    </template>
                  </AppRadioLabel>
                </div>
              </template>
            </AppRadioGroup>
          </div>
        </div>

        <div class="grid justify-end gap-4">
          <AppButton
            :disabled="form.timeValue === -1"
            lg
            class="rounded-lg bg-qwerty-primary"
            primary
            @click="handleConfirm"
          >
            Confirm
          </AppButton>
        </div>
      </div>
    </AppHocLoading>
  </AppModal>
</template>
