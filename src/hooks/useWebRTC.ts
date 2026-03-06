import { useState, useEffect, useRef, useCallback } from 'react';
import { User, SignalData } from '../types';

export function useWebRTC(
  socket: WebSocket | null,
  localUserId: string,
  localUserName: string,
  roomId: string,
  workspaceId: string,
  enabled: boolean = false
) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [participants, setParticipants] = useState<User[]>([]);
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  const createPeerConnection = useCallback((targetId: string, isInitiator: boolean) => {
    if (peerConnections.current.has(targetId)) return peerConnections.current.get(targetId)!;

    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.send(JSON.stringify({
          type: 'signal',
          payload: {
            targetId,
            senderId: localUserId,
            signal: { type: 'candidate', candidate: event.candidate }
          }
        }));
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(targetId, event.streams[0]);
        return next;
      });
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    if (isInitiator) {
      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer);
        socket?.send(JSON.stringify({
          type: 'signal',
          payload: {
            targetId,
            senderId: localUserId,
            signal: { type: 'offer', sdp: offer.sdp }
          }
        }));
      });
    }

    peerConnections.current.set(targetId, pc);
    return pc;
  }, [socket, localUserId]);

  useEffect(() => {
    if (!enabled) {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        setLocalStream(null);
        localStreamRef.current = null;
      }
      return;
    }

    async function setupLocalMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        localStreamRef.current = stream;
      } catch (err) {
        console.error('Error accessing media devices:', err);
      }
    }
    setupLocalMedia();

    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [enabled]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = async (event: MessageEvent) => {
      const { type, payload } = JSON.parse(event.data);

      switch (type) {
        case 'room-state':
          setParticipants(payload.users);
          // Initiate connections to existing users
          payload.users.forEach((user: User) => {
            if (user.id !== localUserId) {
              createPeerConnection(user.id, true);
            }
          });
          break;

        case 'user-joined':
          setParticipants((prev) => [...prev, { id: payload.userId, name: payload.userName, roomId, workspaceId }]);
          // New user joined, they will initiate connections to us
          break;

        case 'user-left':
          setParticipants((prev) => prev.filter(u => u.id !== payload.userId));
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(payload.userId);
            return next;
          });
          if (peerConnections.current.has(payload.userId)) {
            peerConnections.current.get(payload.userId)?.close();
            peerConnections.current.delete(payload.userId);
          }
          break;

        case 'signal': {
          const { senderId, signal } = payload;
          let pc = peerConnections.current.get(senderId);
          
          if (!pc) {
            pc = createPeerConnection(senderId, false);
          }

          if (signal.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.send(JSON.stringify({
              type: 'signal',
              payload: {
                targetId: senderId,
                senderId: localUserId,
                signal: { type: 'answer', sdp: answer.sdp }
              }
            }));
          } else if (signal.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
          } else if (signal.type === 'candidate') {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
          break;
        }
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [socket, localUserId, roomId, createPeerConnection]);

  return { localStream, remoteStreams, participants };
}
