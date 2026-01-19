import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloseButton, Icon } from '../ui'
import { fetchNotifications, markNotificationsRead, type AggregatedNotification } from '../../lib/api/api'
import { fetchProfiles, fetchEventsByIds } from '../../lib/nostr/relay'
import { getMyPubkey } from '../../lib/nostr/keys'
import { formatTimestamp } from '../../lib/nostr/format'
import '../../styles/components/notification-panel.css'
import type { Profile, Event } from '../../types'

interface NotificationPanelProps {
  onClose?: () => void
  onUnreadChange?: (hasUnread: boolean) => void
}

export function NotificationPanel({ onClose, onUnreadChange }: NotificationPanelProps) {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<AggregatedNotification[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile | null>>({})
  const [events, setEvents] = useState<Record<string, Event>>({})
  const [loading, setLoading] = useState(true)

  // Load notifications
  const loadNotifications = useCallback(async () => {
    const pubkey = getMyPubkey()
    if (!pubkey) {
      setLoading(false)
      return
    }

    try {
      const data = await fetchNotifications(pubkey)
      setNotifications(data.notifications)
      onUnreadChange?.(data.hasUnread)

      // Collect pubkeys and event IDs
      const actorPubkeys = new Set<string>()
      const eventIds = new Set<string>()
      for (const n of data.notifications) {
        for (const actor of n.actors) {
          actorPubkeys.add(actor.pubkey)
        }
        eventIds.add(n.targetEventId)
        if (n.sourceEventId) {
          eventIds.add(n.sourceEventId)
        }
      }

      // Fetch profiles and events in parallel
      const [profilesData, eventsData] = await Promise.all([
        actorPubkeys.size > 0 ? fetchProfiles(Array.from(actorPubkeys)) : Promise.resolve({}),
        eventIds.size > 0 ? fetchEventsByIds(Array.from(eventIds)) : Promise.resolve({}),
      ])
      setProfiles(profilesData)
      setEvents(eventsData)
    } catch (e) {
      console.error('Failed to load notifications:', e)
    } finally {
      setLoading(false)
    }
  }, [onUnreadChange])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // Handle notification click
  const handleNotificationClick = async (notification: AggregatedNotification) => {
    // Mark as read
    if (notification.readAt === null) {
      await markNotificationsRead(notification.ids)
      // Update local state (compare arrays by joining to string)
      const idsKey = notification.ids.join('-')
      setNotifications((prev) =>
        prev.map((n) => (n.ids.join('-') === idsKey ? { ...n, readAt: Date.now() / 1000 } : n))
      )
      // Check if any unread remain
      const hasUnread = notifications.some((n) => n.ids.join('-') !== idsKey && n.readAt === null)
      onUnreadChange?.(hasUnread)
    }

    // Navigate to the post
    // For reply, navigate to the reply itself (sourceEventId)
    // For stella/repost, navigate to the target post
    const targetId =
      notification.type === 'reply' && notification.sourceEventId
        ? notification.sourceEventId
        : notification.targetEventId

    onClose?.()
    navigate(`/post/${targetId}`)
  }

  // Get display name for actor
  const getDisplayName = (pubkey: string): string => {
    const profile = profiles[pubkey]
    return profile?.display_name || profile?.name || pubkey.slice(0, 8) + '...'
  }

  // Get content preview
  const getContentPreview = (notification: AggregatedNotification): string => {
    // For reply, show the reply content
    if (notification.type === 'reply' && notification.sourceEventId) {
      const replyEvent = events[notification.sourceEventId]
      if (replyEvent) {
        return truncate(replyEvent.content, 50)
      }
    }
    // For stella/repost, show the target post content
    const targetEvent = events[notification.targetEventId]
    if (targetEvent) {
      return truncate(targetEvent.content, 50)
    }
    return ''
  }

  // Truncate text
  const truncate = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  // Render actor names (for reply/repost)
  const renderActors = (notification: AggregatedNotification): string => {
    const names = notification.actors.slice(0, 3).map((a) => getDisplayName(a.pubkey))
    const remaining = notification.actors.length - 3
    if (remaining > 0) {
      return `${names.join(', ')} +${remaining}`
    }
    return names.join(', ')
  }

  // Stella color to fill color mapping
  const stellaColorMap: Record<string, string> = {
    yellow: '#f1c40f',
    green: '#2ecc71',
    red: '#e74c3c',
    blue: '#3498db',
    purple: '#9b59b6',
  }

  // Render stella info: "2人から +⭐3 +💙2"
  const renderStellaInfo = (notification: AggregatedNotification) => {
    // Count unique actors
    const uniqueActors = new Set(notification.actors.map((a) => a.pubkey))
    const actorCount = uniqueActors.size

    // Aggregate stella counts by color
    const byColor: Record<string, number> = {}
    for (const actor of notification.actors) {
      const color = actor.stellaColor || 'yellow'
      const count = actor.stellaCount || 1
      byColor[color] = (byColor[color] || 0) + count
    }

    // Sort colors: yellow first, then by count
    const colorOrder = ['yellow', 'green', 'red', 'blue', 'purple']
    const sortedColors = Object.keys(byColor).sort((a, b) => {
      return colorOrder.indexOf(a) - colorOrder.indexOf(b)
    })

    return (
      <>
        <span className="notification-actor-count">{actorCount}人から</span>
        {sortedColors.map((color) => (
          <span key={color} className="notification-stella-badge">
            <Icon name="Star" size={14} fill={stellaColorMap[color] || '#f1c40f'} />
            <span className="notification-stella-count">+{byColor[color]}</span>
          </span>
        ))}
      </>
    )
  }

  // Get icon for notification type (reply/repost only)
  const getIcon = (type: 'reply' | 'repost') => {
    switch (type) {
      case 'reply':
        return <Icon name="MessageCircle" size={16} className="notification-icon notification-icon-reply" />
      case 'repost':
        return <Icon name="Repeat2" size={16} className="notification-icon notification-icon-repost" />
    }
  }

  // Get action text for notification type (reply/repost only)
  const getActionText = (type: 'reply' | 'repost') => {
    switch (type) {
      case 'reply':
        return 'replied'
      case 'repost':
        return 'reposted'
    }
  }

  const pubkey = getMyPubkey()

  return (
    <div className="notification-panel">
      <div className="notification-panel-header">
        <span className="notification-panel-title">Notifications</span>
        {onClose && <CloseButton onClick={onClose} size={18} />}
      </div>

      <div className="notification-panel-content">
        {!pubkey ? (
          <div className="notification-empty">Login to see notifications</div>
        ) : loading ? (
          <div className="notification-loading">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="notification-empty">No notifications</div>
        ) : (
          <div className="notification-list">
            {notifications.map((notification) => (
              <button
                key={notification.ids.join('-')}
                className={`notification-item ${notification.readAt === null ? 'unread' : 'read'}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notification-item-header">
                  {notification.type === 'stella' ? (
                    renderStellaInfo(notification)
                  ) : (
                    <>
                      {getIcon(notification.type)}
                      <span className="notification-actors">{renderActors(notification)}</span>
                      <span className="notification-action">{getActionText(notification.type)}</span>
                    </>
                  )}
                </div>
                <div className="notification-item-content">
                  <span className="notification-preview">{getContentPreview(notification)}</span>
                </div>
                <div className="notification-item-footer">
                  <span className="notification-time">{formatTimestamp(notification.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
