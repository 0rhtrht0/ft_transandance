import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SocialNotificationsTab from '../routes/friends/components/SocialNotificationsTab.vue'

describe('SocialNotificationsTab', () => {
  it('renders all persisted notification types in the notifications section', () => {
    const wrapper = mount(SocialNotificationsTab, {
      props: {
        notifications: [
          {
            id: 1,
            type: 'friend_removed_self',
            title: 'trinity',
            message: 'You removed trinity from your friends.',
            read: false,
            created_at: '2026-04-04T10:00:00Z'
          },
          {
            id: 2,
            type: 'game_victory_self',
            title: 'Victory',
            message: 'Solo victory | stage 2 · moyen | Points: +1 EP | Wallet: 1 EP',
            read: false,
            created_at: '2026-04-04T10:01:00Z'
          },
          {
            id: 3,
            type: 'message_sent_self',
            title: 'sandy',
            message: 'Salut',
            read: true,
            created_at: '2026-04-04T10:02:00Z'
          },
          {
            id: 4,
            type: 'presence.online',
            title: 'neo42',
            message: 'neo42 is now online.',
            read: false,
            created_at: '2026-04-04T10:03:00Z'
          },
          {
            id: 5,
            type: 'match_found',
            title: 'Game',
            message: 'Multiplayer match ready | stage 2 · moyen | Game #99',
            read: false,
            created_at: '2026-04-04T10:04:00Z'
          },
          {
            id: 6,
            type: 'chat',
            title: 'Chat',
            message: 'Conversation with sandy opened.',
            read: false,
            created_at: '2026-04-04T10:05:00Z'
          },
          {
            id: 7,
            type: 'info',
            title: 'Friends',
            message: 'You are already friends.',
            read: false,
            created_at: '2026-04-04T10:06:00Z'
          }
        ]
      },
      global: {
        stubs: {
          AppIcon: {
            template: '<span class="app-icon-stub" />'
          }
        }
      }
    })

    const text = wrapper.text()
    expect(text).toContain('trinity')
    expect(text).toContain('was removed from your friends')
    expect(text).toContain('Game')
    expect(text).toContain('you won a match')
    expect(text).toContain('Solo victory | stage 2 · moyen | Points: +1 EP | Wallet: 1 EP')
    expect(text).toContain('sandy')
    expect(text).toContain('received your message')
    expect(text).toContain('Salut')
    expect(text).toContain('neo42')
    expect(text).toContain('is now online')
    expect(text).toContain('Multiplayer match ready | stage 2 · moyen | Game #99')
    expect(text).toContain('found a match')
    expect(text).toContain('Chat')
    expect(text).toContain('shared a chat update')
    expect(text).toContain('Conversation with sandy opened')
    expect(text).toContain('Friends')
    expect(text).toContain('shared an update')
    expect(text).toContain('You are already friends')
    expect(wrapper.findAll('.notification-card')).toHaveLength(7)
  })
})
