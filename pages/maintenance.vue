<script lang="ts" setup>
definePageMeta({
  layout: 'blank'
})
</script>

<template>
  <main class="flex flex-col h-screen w-full">
    <div class="container flex flex-col h-full p-4 sm:p-20">
      <div class="flex items-center justify-center mx-auto">
        <AssetLogo class="h-48 w-48 mr-2" alt="Qwerty" />
      </div>

      <div
        class="h-[calc(100%-20px)] flex flex-col justify-center items-center"
      >
        <h1 class="text-qwerty-white font-bold text-3xl text-center">
          {{ $t('maintenance_header') }}
        </h1>

        <h2 class="text-qwerty-white text-xl text-center my-4 max-w-xl">
          {{ $t('maintenance_body') }}
        </h2>

        <div class="text-center">
          <NuxtLink to="https://twitter.com/QwertyExchange" target="_blank">
            <AppButton xl primary class="rounded-full">
              <span class="font-semibold">
                {{ $t('maintenance_button') }}
              </span>
            </AppButton>
          </NuxtLink>
        </div>
      </div>
    </div>
  </main>
</template>
