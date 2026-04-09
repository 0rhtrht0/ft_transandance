<template>
  <section class="social-tab">
    <header class="section-header">
      <h2>Notifications</h2>
      <span>{{ unreadCount }} unread</span>
    </header>

    <div v-if="notifications.length === 0" class="empty">
      No notifications yet.
    </div>

    <div v-for="notification in notifications" :key="notification.id" class="notification-row">
      <div class="content">
        <strong>{{ notification.title }}</strong>
        <p>{{ notification.message }}</p>
      </div>
      <button
        v-if="!notification.read"
        type="button"
        @click="markAsRead(notification.id)"
      >
        Mark read
      </button>
    </div>
  </section>
</template>

<script setup>
import { onMounted } from 'vue'
import { useSocialNotifications } from '@/composables/social/useSocialNotifications'

const { notifications, unreadCount, addNotification, markAsRead } = useSocialNotifications()

onMounted(() => {
  addNotification({
    title: 'System',
    message: 'Notifications tab is ready.',
    read: false
  })
})
</script>

<style scoped>
.social-tab {
  display: grid;
  gap: 12px;
}

.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.notification-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
}

.content p {
  margin: 4px 0 0;
  color: #666;
}

.empty {
  color: #777;
}
</style>
