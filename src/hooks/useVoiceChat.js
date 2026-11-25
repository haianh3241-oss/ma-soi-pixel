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
  const [masterVolume, setMasterVolumeState] = useState(() => {
    const saved = localStorage.getItem('macho_voice_vol');
    return saved !== null ? Number(saved) : 1;
  });

  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map()); // peerId -> { pc, audioSender, audioEl, stream, analyser, pendingCandidates }
  const audioCtxRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const voicePermsRef = useRef(voicePerms);
  const micEnabledRef = useRef(micEnabled);

  voicePermsRef.current = voicePerms;
  micEnabledRef.current = micEnabled;

  // Enforce mic track enablement AND two-ended WebRTC sender gating strictly from server audibleToPeerIds
  const syncLocalTrackState = useCallback(() => {
    const stream = localStreamRef.current;
    const localTrack = stream?.getAudioTracks?.()[0] || null;
    const allowed = Boolean(voicePermsRef.current?.canSpeak) && micEnabledRef.current;
    if (stream) {
      stream.getAudioTracks().forEach((t) => {
        t.enabled = allowed;
      });
    }

    const audible = new Set(voicePermsRef.current?.audibleToPeerIds || []);
    peersRef.current.forEach((entry, peerId) => {
      const sender =
        entry.audioSender ||
        entry.pc.getSenders().find((s) => s.track?.kind === 'audio') ||
        entry.pc.getTransceivers().find((t) => t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio')
          ?.sender ||
        null;
      if (!sender) return;
      entry.audioSender = sender;
      const targetTrack = allowed && localTrack && audible.has(peerId) ? localTrack : null;
      if (sender.track !== targetTrack) {
        sender.replaceTrack(targetTrack).catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    syncLocalTrackState();
  }, [micEnabled, voicePerms?.canSpeak, voicePerms?.audibleToPeerIds, syncLocalTrackState]);

  const unlockAudioPlayback = useCallback(() => {
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    peersRef.current.forEach((entry) => {
      if (entry.audioEl && entry.audioEl.srcObject && entry.audioEl.paused) {
        entry.audioEl.play().catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudioPlayback, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudioPlayback);
    };
  }, [unlockAudioPlayback]);

  // Enforce incoming peer audio muting strictly from server hearablePeerIds
  useEffect(() => {
    const hearable = new Set(voicePerms?.hearablePeerIds || []);
    peersRef.current.forEach((entry, peerId) => {
      if (entry.audioEl) {
        entry.audioEl.muted = !hearable.has(peerId);
        entry.audioEl.volume = Math.max(0, Math.min(1, masterVolume * (peerVolumes[peerId] ?? 1)));
      }
    });
  }, [voicePerms?.hearablePeerIds, peerVolumes, masterVolume]);

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
      const entry = {
        pc,
        audioSender: null,
        audioEl: null,
        stream: null,
        analyser: null,
        pendingCandidates: [],
      };
      peersRef.current.set(peerId, entry);

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('webrtc:signal', {
            toPlayerId: peerId,
            signal: { type: 'candidate', candidate: e.candidate },
          });
        }
      };

      pc.ontrack = (e) => {
        const remoteStream = (e.streams && e.streams[0]) || (e.track ? new MediaStream([e.track]) : null);
        if (remoteStream) {
          attachRemoteStream(peerId, remoteStream);
        }
      };

      pc.onconnectionstatechange = () => {
        if (['failed', 'closed'].includes(pc.connectionState)) {
          cleanupPeer(peerId);
        }
      };

      if (initiator) {
        try {
          const transceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
          entry.audioSender = transceiver.sender;
        } catch {
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((track) => {
              entry.audioSender = pc.addTrack(track, localStreamRef.current);
            });
          }
        }
        syncLocalTrackState();

        pc.createOffer()
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
    [socket, myId, attachRemoteStream, cleanupPeer, syncLocalTrackState]
  );

  // Request microphone
  const toggleMic = useCallback(async () => {
    unlockAudioPlayback();
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

        // Setup local analyser
        try {
          if (!audioCtxRef.current) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) audioCtxRef.current = new Ctx();
          }
          if (audioCtxRef.current?.state === 'suspended') {
            audioCtxRef.current.resume().catch(() => {});
          }
          if (audioCtxRef.current) {
            const src = audioCtxRef.current.createMediaStreamSource(stream);
            const analyser = audioCtxRef.current.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            localAnalyserRef.current = analyser;
          }
        } catch {}

        // Attach audio track via existing transceivers without triggering SDP renegotiation glare
        syncLocalTrackState();
      } catch {
        setMicPermission('denied');
      }
    } else {
      setMicEnabled((prev) => {
        const next = !prev;
        micEnabledRef.current = next;
        syncLocalTrackState();
        return next;
      });
    }
  }, [syncLocalTrackState, unlockAudioPlayback]);

  // Listen for incoming WebRTC signals
  useEffect(() => {
    if (!socket) return;
    const onSignal = async ({ fromPlayerId, signal }) => {
      let entry = peersRef.current.get(fromPlayerId);
      let pc = entry?.pc;
      if (!pc) {
        pc = createPeerConnection(fromPlayerId, false);
        entry = peersRef.current.get(fromPlayerId);
      }
      if (!pc) return;

      try {
        if (signal.type === 'sdp') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          if (entry?.pendingCandidates?.length) {
            const queued = entry.pendingCandidates.splice(0);
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch {}
            }
          }

          if (signal.sdp.type === 'offer') {
            const audioTransceiver = pc
              .getTransceivers()
              .find((t) => t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio');
            if (audioTransceiver) {
              audioTransceiver.direction = 'sendrecv';
              if (entry) entry.audioSender = audioTransceiver.sender;
            }
            syncLocalTrackState();

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc:signal', {
              toPlayerId: fromPlayerId,
              signal: { type: 'sdp', sdp: pc.localDescription },
            });
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          if (!pc.remoteDescription) {
            entry?.pendingCandidates.push(signal.candidate);
          } else {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
        }
      } catch {}
    };

    socket.on('webrtc:signal', onSignal);
    return () => {
      socket.off('webrtc:signal', onSignal);
    };
  }, [socket, createPeerConnection, syncLocalTrackState]);

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

  const setMasterVolume = useCallback((val) => {
    const clamped = Math.max(0, Math.min(1, val));
    setMasterVolumeState(clamped);
    localStorage.setItem('macho_voice_vol', String(clamped));
  }, []);

  return {
    micEnabled: micEnabled && Boolean(voicePerms?.canSpeak),
    userMicWanted: micEnabled,
    micPermission,
    speakingPeers,
    peerVolumes,
    masterVolume,
    toggleMic,
    setVolume,
    setMasterVolume,
  };
}
