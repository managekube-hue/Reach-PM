# SLACK-LIKE CHAT - REAL UX GAPS

## ✅ BACKEND WORKING
- Edge functions deployed
- Database schema complete
- Message sending/receiving works
- Presence tracking works
- File uploads work

## 🔴 CRITICAL UX MISSING

### 1. INLINE MESSAGE COMPOSER
**Current**: Composer in floating side panel (line 662 App.tsx)
**Needed**: Inline composer below messages (like Slack)
**Fix**: Use `InlineComposer.tsx` component created

### 2. DM-SPECIFIC VIEW
**Current**: DMs render same as channels with `#{name}` (line 426)
**Needed**: Different header/layout for DMs vs channels
**Fix**: Use `MessageList.tsx` with `conversationType` prop

### 3. PRESENCE IN MESSAGE THREAD
**Current**: Presence only in sidebar member list
**Needed**: Green dot on avatars in message thread showing who's online NOW
**Fix**: `MessageList.tsx` shows presence indicators on avatars

### 4. NOTIFICATION VISUAL DISTINCTION
**Current**: Same badge for all notifications (line 370, 398)
**Needed**: 
  - Red badge for @mentions
  - Blue badge for DMs
  - Gray badge for channel messages
**Fix**: Use `NotificationBadge.tsx` with type prop

### 5. KEYBOARD SHORTCUTS NOT WIRED
**Current**: Key bindings defined in `reachCommunication.ts` but not connected
**Needed**: 
  - Ctrl+K for search
  - Alt+↑/↓ for channel navigation
  - Ctrl+B for sidebar toggle
  - Escape to mark as read
**Fix**: Use `useKeyBindings.ts` hook

### 6. MULTI-USER ONLINE VISIBILITY
**Current**: Online count shown (line 1979) but not WHO is online
**Needed**: 
  - Live presence list in sidebar
  - Online indicators update in real-time
  - "X people online" with expandable list
**Fix**: Wire Supabase realtime subscription to presence updates

### 7. CHANNEL VS DM ALERT ORCHESTRATION
**Current**: All notifications treated same
**Needed**:
  - DMs always notify (high priority)
  - Channels notify only on @mention or keywords
  - Muted channels don't notify
  - Desktop notifications for DMs
**Fix**: Add notification_level logic in `comm_fan_out_message_notification` trigger

### 8. MESSAGE THREADING
**Current**: `parent_message_id` column exists but no UI
**Needed**: Reply-in-thread like Slack
**Fix**: Add thread view component

### 9. UNREAD STATE MANAGEMENT
**Current**: Marks read on load (line 1498)
**Needed**: 
  - Unread line separator
  - Scroll to unread
  - Mark read on visibility
**Fix**: Track last_read_message_id per conversation

### 10. TYPING INDICATORS
**Current**: None
**Needed**: "X is typing..." below composer
**Fix**: Add typing state broadcast via WebSocket

## 📋 INTEGRATION STEPS

1. Replace message rendering in App.tsx line 413-489 with:
```tsx
<MessageList
  messages={messages}
  pinnedMessageIds={pinnedMessageIds}
  presenceMap={presenceByUserId}
  onTogglePin={togglePinMessage}
  conversationType={currentChannel ? 'channel' : 'dm'}
  conversationName={currentChannel?.name || 'Direct Message'}
/>
```

2. Replace composer in App.tsx line 662 with:
```tsx
<InlineComposer
  onSend={handleSendMessage}
  onUpload={uploadCommunicationAsset}
  conversationType={currentChannel ? 'channel' : 'dm'}
  conversationName={currentChannel?.name || 'Direct Message'}
/>
```

3. Replace notification badges in App.tsx line 370, 398 with:
```tsx
<NotificationBadge
  count={unreadCountByConversation[conversation.id] || 0}
  type={conversation.kind === 'dm' ? 'dm' : 'channel'}
/>
```

4. Add keyboard shortcuts in App.tsx after line 1975:
```tsx
useKeyBindings([
  { key: 'k', ctrl: true, action: () => setShowSearch(true), description: 'Search' },
  { key: 'b', ctrl: true, action: () => setIsWorkspaceSidebarCollapsed(prev => !prev), description: 'Toggle sidebar' },
  // ... more bindings
], activeGlobalNav === 'chat');
```

## 🎯 PRIORITY ORDER

1. **Inline composer** (30 min) - Most visible UX issue
2. **Presence indicators** (20 min) - Shows who's actually online
3. **Notification badges** (15 min) - Visual distinction
4. **Keyboard shortcuts** (30 min) - Power user feature
5. **DM-specific view** (20 min) - Proper context
6. **Typing indicators** (1 hour) - Real-time feel
7. **Message threading** (2 hours) - Complex feature
8. **Unread management** (1 hour) - State tracking

**Total effort**: ~6 hours to match Slack UX
