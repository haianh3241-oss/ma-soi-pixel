import { useCallback, useEffect, useRef, useState } from 'react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useVoiceChat({ socket, room, myId, voicePerms }) {
  const [micEnabled, setMicEnabled] = useState(false); // user wants mic ON
  const [micPermission, setMicPermission] = useState('idle'); // 'idle' | 'granted' | 'denied' | 'unsupported'
  const [speakingPeers, setSpeakingPeers] = useState({}); // playerId -> boolean
  const [peerVolumes, setPeerVolumes] = useState({}); // playerId -> 0..1

  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map()); // peerId -> { pc, audioEl, stream, analyser }
  const audioCtxRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const voicePermsRef = useRef(voicePerms);
  const micEnabledRef = useRef(micEnabled);

  voicePermsRef.current = voicePerms;
  micEnabledRef.current = micEnabled;

  // Enforce mic track enablement whenever phase/voice permissions or user mute toggles
  const syncLocalTrackState = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const allowed = Boolean(voicePermsRef.current?.canSpeak) && micEnabledRef.current;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = allowed;
    });
  }, []);

  useEffect(() => {
    syncLocalTrackState();
  }, [micEnabled, voicePerms?.canSpeak, syncLocalTrackState]);

  // Enforce incoming peer audio muting strictly from server hearablePeerIds
  useEffect(() => {
    const hearable = new Set(voicePerms?.hearablePeerIds || []);
    peersRef.current.forEach((entry, peerId) => {
      if (entry.audioEl) {
        entry.audioEl.muted = !hearable.has(peerId);
        entry.audioEl.volume = peerVolumes[peerId] ?? 1;
      }
    });
  }, [voicePerms?.hearablePeerIds, peerVolumes]);

  const cleanupPeer = useCallback((peerId) => {
    const entry = peersRef.current.get(peerId);
    if (!entry) return;
    try {
      entry.pc?.close();
    } catch {}
    if (entry.audioEl) {
      entry.audioEl.srcObject = null;
      entry.audioEl.remove();
    }
    peersRef.current.delete(peerId);
  }, []);

  const attachRemoteStream = useCallback((peerId, stream) => {
    const entry = peersRef.current.get(peerId);
    if (!entry) return;
    entry.stream = stream;

    if (!entry.audioEl) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      document.body.appendChild(audio);
      entry.audioEl = audio;
    }
    entry.audioEl.srcObject = stream;
    const hearable = new Set(voicePermsRef.current?.hearablePeerIds || []);
    entry.audioEl.muted = !hearable.has(peerId);
    entry.audioEl.play().catch(() => {});

    // Analyser for speaking indicator
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      }
      if (audioCtxRef.current) {
        const src = audioCtxRef.current.createMediaStreamSource(stream);
        const analyser = audioCtxRef.current.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        entry.analyser = analyser;
      }
    } catch {}
  }, []);

  const createPeerConnection = useCallback(
    (peerId, initiator) => {
      if (!socket || !myId || peerId === myId) return null;
      if (peersRef.current.has(peerId)) {
        return peersRef.current.get(peerId).pc;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const entry = { pc, audioEl: null, stream: null, analyser: null };
      peersRef.current.set(peerId, entry);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('webrtc:signal', {
            toPlayerId: peerId,
            signal: { type: 'candidate', candidate: e.candidate },
          });
        }
      };

      pc.ontrack = (e) => {
        if (e.streams && e.streams[0]) {
          attachRemoteStream(peerId, e.streams[0]);
        }
      };

      pc.onconnectionstatechange = () => {
        if (['failed', 'closed'].includes(pc.connectionState)) {
          cleanupPeer(peerId);
        }
      };

      if (initiator) {
        pc.createOffer({ offerToReceiveAudio: true })
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit('webrtc:signal', {
              toPlayerId: peerId,
              signal: { type: 'sdp', sdp: pc.localDescription },
            });
          })
          .catch(() => {});
      }

      return pc;
    },
    [socket, myId, attachRemoteStream, cleanupPeer]
  );

  // Request microphone
  const toggleMic = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicPermission('unsupported');
      return;
    }

    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        localStreamRef.current = stream;
        setMicPermission('granted');
        setMicEnabled(true);
        micEnabledRef.current = true;
        syncLocalTrackState();

        // Setup local analyser
        try {
          if (!audioCtxRef.current) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) audioCtxRef.current = new Ctx();
          }
          if (audioCtxRef.current) {
            const src = audioCtxRef.current.createMediaStreamSource(stream);
            const analyser = audioCtxRef.current.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            localAnalyserRef.current = analyser;
          }
        } catch {}

        // Renegotiate with existing peers to attach audio track
        peersRef.current.forEach((entry, peerId) => {
          stream.getTracks().forEach((track) => {
            const senders = entry.pc.getSenders();
            if (!senders.some((s) => s.track === track)) {
              entry.pc.addTrack(track, stream);
            }
          });
          entry.pc
            .createOffer()
            .then((offer) => entry.pc.setLocalDescription(offer))
            .then(() => {
              socket?.emit('webrtc:signal', {
                toPlayerId: peerId,
                signal: { type: 'sdp', sdp: entry.pc.localDescription },
              });
            })
            .catch(() => {});
        });
      } catch {
        setMicPermission('denied');
      }
    } else {
      setMicEnabled((prev) => !prev);
    }
  }, [socket, syncLocalTrackState]);

  // Listen for incoming WebRTC signals
  useEffect(() => {
    if (!socket) return;
    const onSignal = async ({ fromPlayerId, signal }) => {
      let pc = peersRef.current.get(fromPlayerId)?.pc;
      if (!pc) {
        pc = createPeerConnection(fromPlayerId, false);
      }
      if (!pc) return;

      try {
        if (signal.type === 'sdp') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc:signal', {
              toPlayerId: fromPlayerId,
              signal: { type: 'sdp', sdp: pc.localDescription },
            });
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch {}
    };

    socket.on('webrtc:signal', onSignal);
    return () => {
      socket.off('webrtc:signal', onSignal);
    };
  }, [socket, createPeerConnection]);

  // Maintain mesh connections with all connected human players in the room
  useEffect(() => {
    if (!room || !myId) return;
    const humans = room.players.filter((p) => !p.isBot && p.connected && p.id !== myId);
    const activeIds = new Set(humans.map((h) => h.id));

    // Remove departed peers
    Array.from(peersRef.current.keys()).forEach((pid) => {
      if (!activeIds.has(pid)) cleanupPeer(pid);
    });

    // Deterministic initiator: lexically smaller ID initiates offer
    humans.forEach((h) => {
      if (!peersRef.current.has(h.id)) {
        const shouldInitiate = myId < h.id;
        createPeerConnection(h.id, shouldInitiate);
      }
    });
  }, [room?.players, myId, createPeerConnection, cleanupPeer]);

  // Speaking activity polling loop
  useEffect(() => {
    const data = new Uint8Array(64);
    const interval = setInterval(() => {
      const next = {};
      const hearable = new Set(voicePermsRef.current?.hearablePeerIds || []);

      if (localAnalyserRef.current && micEnabledRef.current && voicePermsRef.current?.canSpeak) {
        localAnalyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        if (avg > 14) next[myId] = true;
      }

      peersRef.current.forEach((entry, pid) => {
        if (entry.analyser && hearable.has(pid)) {
          entry.analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          if (avg > 14) next[pid] = true;
        }
      });

      setSpeakingPeers(next);
    }, 180);

    return () => clearInterval(interval);
  }, [myId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      Array.from(peersRef.current.keys()).forEach(cleanupPeer);
    };
  }, [cleanupPeer]);

  const setVolume = useCallback((peerId, val) => {
    setPeerVolumes((prev) => ({ ...prev, [peerId]: val }));
  }, []);

  return {
    micEnabled: micEnabled && Boolean(voicePerms?.canSpeak),
    userMicWanted: micEnabled,
    micPermission,
    speakingPeers,
    peerVolumes,
    toggleMic,
    setVolume,
  };
}
