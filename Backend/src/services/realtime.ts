'use strict';

const { Server } = require('socket.io');
const { CORS_ORIGINS, NODE_ENV } = require('../config/constants');
import type { Server as HttpServer } from 'node:http';

function roomForConversation(conversationId: string) {
  return `conversation:${conversationId}`;
}

function roomForUser(userId: string) {
  return `user:${userId}`;
}

function socketCorsOrigin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
  if (!origin) return callback(null, true);
  const normalized = String(origin).replace(/\/$/, '');
  if (CORS_ORIGINS.includes(normalized)) return callback(null, true);
  if (NODE_ENV !== 'production') {
    try {
      const { hostname } = new URL(normalized);
      const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
      const isPrivateLan =
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);
      if (isLocalhost || isPrivateLan) return callback(null, true);
    } catch {
      return callback(null, false);
    }
  }
  return callback(null, false);
}

function createRealtime({ db, verifyToken, publicUser, hasRole, ROLES, now }) {
  let io: any = null;
  const userSockets = new Map<string, Set<string>>();

  function isParticipant(conversation: any, user: any) {
    return Boolean(
      conversation &&
      user &&
      (conversation.buyerId === user.id || conversation.sellerId === user.id || hasRole(user, ROLES.ADMIN))
    );
  }

  function conversationsForUser(user: any) {
    return (db.conversations || []).filter((conversation: any) => isParticipant(conversation, user));
  }

  function roomPresence(conversationId: string) {
    const conversation = (db.conversations || []).find((item: any) => item.id === conversationId);
    if (!conversation) return { conversationId, users: [] };
    const participantIds = [conversation.buyerId, conversation.sellerId].filter(Boolean);
    const users = participantIds
      .filter((userId: string) => (userSockets.get(userId)?.size || 0) > 0)
      .map((userId: string) => publicUser((db.users || []).find((user: any) => user.id === userId)))
      .filter(Boolean);
    return { conversationId, users, at: now() };
  }

  function emitPresence(conversationId: string) {
    if (!io) return;
    io.to(roomForConversation(conversationId)).emit('conversation:presence', roomPresence(conversationId));
  }

  function joinConversation(socket: any, conversationId: string) {
    const user = socket.data.user;
    const conversation = (db.conversations || []).find((item: any) => item.id === conversationId);
    if (!isParticipant(conversation, user)) {
      socket.emit('realtime:error', { code: 'forbidden', message: 'Conversation is not available.' });
      return false;
    }
    socket.join(roomForConversation(conversationId));
    socket.emit('conversation:presence', roomPresence(conversationId));
    emitPresence(conversationId);
    return true;
  }

  function attach(server: HttpServer) {
    io = new Server(server, {
      cors: {
        origin: socketCorsOrigin,
        credentials: false
      }
    });

    io.use((socket: any, next: (error?: Error) => void) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        const payload = verifyToken(Array.isArray(token) ? token[0] : token);
        const user = (db.users || []).find((item: any) => item.id === payload.sub);
        if (!user) return next(new Error('user_not_found'));
        socket.data.user = user;
        return next();
      } catch {
        return next(new Error('invalid_token'));
      }
    });

    io.on('connection', (socket: any) => {
      const user = socket.data.user;
      const sockets = userSockets.get(user.id) || new Set<string>();
      sockets.add(socket.id);
      userSockets.set(user.id, sockets);

      socket.join(roomForUser(user.id));
      const conversationIds = conversationsForUser(user).map((conversation: any) => conversation.id);
      for (const conversationId of conversationIds) {
        socket.join(roomForConversation(conversationId));
        emitPresence(conversationId);
      }
      socket.emit('realtime:ready', { userId: user.id, conversationIds, at: now() });

      socket.on('conversation:join', (payload: any = {}) => {
        if (payload.conversationId) joinConversation(socket, String(payload.conversationId));
      });

      socket.on('conversation:leave', (payload: any = {}) => {
        const conversationId = String(payload.conversationId || '');
        if (!conversationId) return;
        socket.leave(roomForConversation(conversationId));
        emitPresence(conversationId);
      });

      socket.on('typing:start', (payload: any = {}) => {
        const conversationId = String(payload.conversationId || '');
        if (!joinConversation(socket, conversationId)) return;
        socket.to(roomForConversation(conversationId)).emit('typing:update', {
          conversationId,
          userId: user.id,
          userName: user.name,
          typing: true,
          at: now()
        });
      });

      socket.on('typing:stop', (payload: any = {}) => {
        const conversationId = String(payload.conversationId || '');
        if (!conversationId) return;
        const conversation = (db.conversations || []).find((item: any) => item.id === conversationId);
        if (!isParticipant(conversation, user)) return;
        socket.to(roomForConversation(conversationId)).emit('typing:update', {
          conversationId,
          userId: user.id,
          userName: user.name,
          typing: false,
          at: now()
        });
      });

      socket.on('disconnect', () => {
        const nextSockets = userSockets.get(user.id);
        nextSockets?.delete(socket.id);
        if (!nextSockets || nextSockets.size === 0) userSockets.delete(user.id);
        for (const conversationId of conversationIds) emitPresence(conversationId);
      });
    });

    return io;
  }

  function publishConversationUpsert(conversation: any) {
    if (!io || !conversation) return;
    for (const userId of [conversation.buyerId, conversation.sellerId].filter(Boolean)) {
      io.to(roomForUser(userId)).emit('conversation:upsert', { conversation, at: now() });
    }
  }

  function publishConversationMessage(conversation: any, message: any) {
    if (!io || !conversation || !message) return;
    io.to(roomForConversation(conversation.id)).emit('conversation:message', {
      conversationId: conversation.id,
      message,
      at: now()
    });
  }

  function publishCustomRequestMessage(request: any, message: any) {
    if (!io || !request || !message) return;
    for (const userId of [request.buyerId, request.sellerId].filter(Boolean)) {
      io.to(roomForUser(userId)).emit('custom-request:message', {
        requestId: request.id,
        message,
        at: now()
      });
    }
  }

  return {
    attach,
    publishConversationUpsert,
    publishConversationMessage,
    publishCustomRequestMessage,
    provider: 'socket.io'
  };
}

module.exports = {
  createRealtime,
  roomForConversation,
  roomForUser
};
