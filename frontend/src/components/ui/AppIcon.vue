<template>
  <svg
    class="app-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'blackhole'">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M5 7.5C7.2 5.6 10.1 4.5 13.2 4.5" />
      <path d="M19 16.5C16.8 18.4 13.9 19.5 10.8 19.5" />
    </template>

    <template v-else-if="name === 'users'">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 4.13a3 3 0 0 1 0 5.74" />
    </template>

    <template v-else-if="name === 'message'">
      <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H7l-4 3V12A8.5 8.5 0 0 1 11.5 3.5H12A8.5 8.5 0 0 1 21 12Z" />
    </template>

    <template v-else-if="name === 'bell'">
      <path d="M15 17H5.5A1.5 1.5 0 0 1 4 15.5V15a5 5 0 1 0 10 0v.5a1.5 1.5 0 0 1-1.5 1.5" />
      <path d="M18 17h2" />
      <path d="M9 21a2 2 0 0 0 4 0" />
    </template>

    <template v-else-if="name === 'user'">
      <path d="M20 21a8 8 0 1 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </template>

    <template v-else-if="name === 'inbox'">
      <path d="M4 4h16v11a2 2 0 0 1-2 2h-3l-2 3-2-3H6a2 2 0 0 1-2-2Z" />
      <path d="M8 9h8" />
    </template>

    <template v-else-if="name === 'outbox'">
      <path d="M4 4h16v11a2 2 0 0 1-2 2h-3l-2 3-2-3H6a2 2 0 0 1-2-2Z" />
      <path d="m10 9 4 3-4 3" />
      <path d="M8 12h6" />
    </template>

    <template v-else-if="name === 'satellite'">
      <rect x="8" y="8" width="8" height="8" rx="1" />
      <path d="m6 10-2-2" />
      <path d="m18 14 2 2" />
      <path d="m14 6 2-2" />
      <path d="m10 18-2 2" />
      <path d="M12 8V6" />
      <path d="M16 12h2" />
      <path d="M8 12H6" />
      <path d="M12 16v2" />
    </template>

    <template v-else-if="name === 'online'">
      <circle cx="12" cy="12" r="7" />
      <path d="M9.5 12.2 11 13.7l3.5-3.4" />
    </template>

    <template v-else-if="name === 'offline'">
      <circle cx="12" cy="12" r="7" />
      <path d="m9.5 9.5 5 5" />
      <path d="m14.5 9.5-5 5" />
    </template>

    <template v-else-if="name === 'warning'">
      <path d="M10.3 4.9 3.7 17a2 2 0 0 0 1.8 3h13a2 2 0 0 0 1.8-3L13.7 4.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </template>

    <template v-else-if="name === 'send'">
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    </template>

    <template v-else-if="name === 'image'">
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="m6 16 3.8-3.8a1.5 1.5 0 0 1 2.1 0L14 14.3" />
      <path d="m12 16 2.6-2.6a1.5 1.5 0 0 1 2.1 0L18 15" />
    </template>

    <template v-else-if="name === 'folder'">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z" />
    </template>

    <template v-else-if="name === 'file'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </template>

    <template v-else-if="name === 'upload'">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
    </template>

    <template v-else-if="name === 'download'">
      <path d="M12 4v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4 20v-1a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
    </template>

    <template v-else-if="name === 'trash'">
      <path d="M3 6h18" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
      <path d="m6 6 1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
      <path d="M10 10v7" />
      <path d="M14 10v7" />
    </template>

    <template v-else-if="name === 'arrow-left'">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </template>

    <template v-else-if="name === 'keyboard'">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01" />
      <path d="M11 10h.01" />
      <path d="M15 10h.01" />
      <path d="M7 14h10" />
    </template>

    <template v-else-if="name === 'smile'">
      <circle cx="12" cy="12" r="8" />
      <path d="M9.2 10h.01" />
      <path d="M14.8 10h.01" />
      <path d="M8.8 14.2a4.2 4.2 0 0 0 6.4 0" />
    </template>

    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </template>

    <template v-else-if="name === 'check'">
      <path d="M20 6 9 17l-5-5" />
    </template>

    <template v-else-if="name === 'x'">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </template>

    <template v-else-if="name === 'trash-2'">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </template>

    <template v-else-if="name === 'user-plus'">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="16" x2="22" y1="11" y2="11" />
    </template>

    <template v-else-if="name === 'user-minus'">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </template>

    <template v-else-if="name === 'user-check'">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </template>

    <template v-else-if="name === 'user-x'">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" x2="22" y1="8" y2="13" />
      <line x1="22" x2="17" y1="8" y2="13" />
    </template>

    <template v-else-if="name === 'shield'">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </template>

    <template v-else-if="name === 'award'">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </template>

    <template v-else-if="name === 'zap'">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </template>

    <template v-else-if="name === 'star'">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </template>

    <template v-else>
      <circle cx="12" cy="12" r="8" />
    </template>
  </svg>
</template>

<script setup>
defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: [Number, String],
    default: 16
  },
  strokeWidth: {
    type: [Number, String],
    default: 1.9
  }
})
</script>

<style scoped>
.app-icon {
  display: inline-block;
  vertical-align: middle;
  flex: 0 0 auto;
}
</style>
