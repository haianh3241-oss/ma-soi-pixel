import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeAdpcm, downsampleTo16k, encodeAdpcm } from '../audio/adpcm.js';

export function useVoiceChat({ socket, room, myId, voicePerms }) {
  const [micEnabled, setMicEnabled] = useState(false); // user wants mic ON
  const [micPermission, setMicPermission] = useState('idle'); // 'idle' | 'granted' | 'denied' | 'unsupported'
  const [localMicLevel, setLocalMicLevel] = useState(0); // 0..100 live mic meter
  const [speakingPeers, setSpeakingPeers] = useState({}); // playerId -> boolean
  const [peerVolumes, setPeerVolumes] = useState({}); // playerId -> 0..2
  const [masterVolume, setMasterVolumeState] = useState(() => {
    const saved = localStorage.getItem('macho_voice_vol');
    return saved !== null ? Math.max(0, Math.min(2, Number(saved))) : 1;
  });

  const localStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const compressorRef = useRef(null);
  const masterGainRef = useRef(null);
  const processorRef = useRef(null);
  const captureGainRef = useRef(null);
  const localSourceRef = useRef(null);

  const peerGainsRef = useRef(new Map()); // peerId -> GainNode
  const peerNextTimeRef = useRef(new Map()); // peerId -> scheduled audioCtx.currentTime
  const speakingUntilRef = useRef(new Map()); // playerId -> timestamp ms

  const voicePermsRef = useRef(voicePerms);
  const micEnabledRef = useRef(micEnabled);
  const peerVolumesRef = useRef(peerVolumes);
  const masterVolumeRef = useRef(masterVolume);
  const agcGainRef = useRef(1.2);
  const vadHoldRef = useRef(0);

  voicePermsRef.current = voicePerms;
  micEnabledRef.current = micEnabled;
  peerVolumesRef.current = peerVolumes;
  masterVolumeRef.current = masterVolume;

  const ensureAudioOutput = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 18;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.16;

      const masterGain = ctx.createGain();
      masterGain.gain.value = masterVolumeRef.current;

      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);

      audioCtxRef.current = ctx;
      compressorRef.current = compressor;
      masterGainRef.current = masterGain;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  // Unlock output AudioContext on any mobile/desktop touch
  useEffect(() => {
    const unlock = () => ensureAudioOutput();
    window.addEventListener('pointerdown', unlock, { passive: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [ensureAudioOutput]);

  // Enforce strict per-peer & master volume AND hearable gating immediately
  const syncPeerGains = useCallback(() => {
    const hearable = new Set(voicePermsRef.current?.hearablePeerIds || []);
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(
        Math.max(0, Math.min(2, masterVolumeRef.current)),
        audioCtxRef.current.currentTime,
        0.015
      );
    }
    peerGainsRef.current.forEach((gainNode, peerId) => {
      const target = hearable.has(peerId)
        ? Math.max(0, Math.min(2.4, (peerVolumesRef.current[peerId] ?? 1) * 1.15))
        : 0;
      if (audioCtxRef.current) {
        gainNode.gain.setTargetAtTime(target, audioCtxRef.current.currentTime, 0.015);
      } else {
        gainNode.gain.value = target;
      }
    });
  }, []);

  useEffect(() => {
    syncPeerGains();
  }, [voicePerms?.hearablePeerIds, peerVolumes, masterVolume, syncPeerGains]);

  // Reflect local stream track muted state on UI permission changes
  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const allowed = Boolean(voicePerms?.canSpeak) && micEnabled;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = allowed;
    });
    if (!allowed) setLocalMicLevel(0);
  }, [micEnabled, voicePerms?.canSpeak]);

  // Setup local capture -> Adaptive AGC + VAD Gate -> 16kHz IMA-ADPCM -> Server SFU relay
  const setupMicPipeline = useCallback(
    (stream) => {
      const ctx = ensureAudioOutput();
      if (!ctx) return;

      try {
        processorRef.current?.disconnect();
        localSourceRef.current?.disconnect();
        captureGainRef.current?.disconnect();
      } catch {}

      const src = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      const zeroOut = ctx.createGain();
      zeroOut.gain.value = 0;

      processor.onaudioprocess = (ev) => {
        const perms = voicePermsRef.current;
        const allowed = Boolean(perms?.canSpeak) && micEnabledRef.current;
        if (!allowed || !socket?.connected) {
          vadHoldRef.current = 0;
          return;
        }

        const raw = ev.inputBuffer.getChannelData(0);
        let sumSq = 0;
        for (let i = 0; i < raw.length; i++) sumSq += raw[i] * raw[i];
        const rms = Math.sqrt(sumSq / raw.length);

        // Smooth Voice Activity Detection gate (~320ms hangover tail so word endings don't clip)
        if (rms > 0.0065) {
          vadHoldRef.current = 8;
        } else if (vadHoldRef.current > 0) {
          vadHoldRef.current -= 1;
        }

        if (vadHoldRef.current <= 0) {
          setLocalMicLevel((prev) => (prev > 2 ? 0 : prev));
          return;
        }

        // Adaptive Automatic Gain Control so whisperers boost clearly and shouters don't clip
        const desiredGain = Math.min(3.4, Math.max(0.75, 0.14 / Math.max(rms, 0.01)));
        const rate = desiredGain < agcGainRef.current ? 0.35 : 0.08;
        agcGainRef.current = agcGainRef.current * (1 - rate) + desiredGain * rate;

        const gain = agcGainRef.current;
        const normalized = new Float32Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
          normalized[i] = Math.tanh(raw[i] * gain);
        }

        const visualLevel = Math.min(100, Math.round(Math.min(1, rms * gain * 3.2) * 100));
        setLocalMicLevel(visualLevel);
        speakingUntilRef.current.set(myId, Date.now() + 320);

        if (!perms?.audibleToPeerIds?.length) return;
        const pcm16k = downsampleTo16k(normalized, ctx.sampleRate);
        const packet = encodeAdpcm(pcm16k);
        socket.emit('voice:chunk', { audio: packet.buffer, level: visualLevel });
      };

      src.connect(processor);
      processor.connect(zeroOut);
      zeroOut.connect(ctx.destination);

      localSourceRef.current = src;
      processorRef.current = processor;
      captureGainRef.current = zeroOut;
    },
    [ensureAudioOutput, myId, socket]
  );

  // Recreate capture connection cleanly if socket reconnects while mic stream is already open
  useEffect(() => {
    if (localStreamRef.current && socket) {
      setupMicPipeline(localStreamRef.current);
    }
  }, [socket, setupMicPipeline]);

  // Receive voice packets from Server SFU relay and play through compressor
  useEffect(() => {
    if (!socket) return;

    const onVoiceChunk = ({ fromId, audio }) => {
      if (!fromId || fromId === myId || !audio) return;
      const hearable = new Set(voicePermsRef.current?.hearablePeerIds || []);
      if (!hearable.has(fromId)) return;

      const ctx = ensureAudioOutput();
      if (!ctx || ctx.state === 'suspended' || !compressorRef.current) return;

      const pcm = decodeAdpcm(audio);
      if (pcm.length === 0) return;

      speakingUntilRef.current.set(fromId, Date.now() + 360);

      let gainNode = peerGainsRef.current.get(fromId);
      if (!gainNode) {
        gainNode = ctx.createGain();
        gainNode.gain.value = Math.max(0, Math.min(2.4, (peerVolumesRef.current[fromId] ?? 1) * 1.15));
        gainNode.connect(compressorRef.current);
        peerGainsRef.current.set(fromId, gainNode);
      }

      const buffer = ctx.createBuffer(1, pcm.length, 16000);
      buffer.copyToChannel(pcm, 0);

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(gainNode);

      const now = ctx.currentTime;
      let nextTime = peerNextTimeRef.current.get(fromId) || 0;
      if (nextTime < now || nextTime > now + 0.25) {
        nextTime = now + 0.055; // 55ms smooth jitter buffer
      }
      src.start(nextTime);
      peerNextTimeRef.current.set(fromId, nextTime + buffer.duration);
    };

    socket.on('voice:chunk', onVoiceChunk);
    return () => {
      socket.off('voice:chunk', onVoiceChunk);
    };
  }, [socket, myId, ensureAudioOutput]);

  // Clean up departed peer buffers when room players change
  useEffect(() => {
    if (!room?.players) return;
    const ids = new Set(room.players.map((p) => p.id));
    peerGainsRef.current.forEach((node, pid) => {
      if (!ids.has(pid)) {
        try {
          node.disconnect();
        } catch {}
        peerGainsRef.current.delete(pid);
        peerNextTimeRef.current.delete(pid);
      }
    });
  }, [room?.players]);

  // Speaking activity badge ticker
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const hearable = new Set(voicePermsRef.current?.hearablePeerIds || []);
      const next = {};
      speakingUntilRef.current.forEach((until, pid) => {
        if (until > now) {
          if (pid === myId) {
            if (micEnabledRef.current && voicePermsRef.current?.canSpeak) next[pid] = true;
          } else if (hearable.has(pid)) {
            next[pid] = true;
          }
        } else {
          speakingUntilRef.current.delete(pid);
        }
      });
      setSpeakingPeers((prev) => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(next);
        if (prevKeys.length === nextKeys.length && nextKeys.every((k) => prev[k])) return prev;
        return next;
      });
    }, 150);
    return () => clearInterval(iv);
  }, [myId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        processorRef.current?.disconnect();
        localSourceRef.current?.disconnect();
        captureGainRef.current?.disconnect();
      } catch {}
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleMic = useCallback(async () => {
    ensureAudioOutput();
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
            channelCount: 1,
          },
        });
        localStreamRef.current = stream;
        setMicPermission('granted');
        setMicEnabled(true);
        micEnabledRef.current = true;
        setupMicPipeline(stream);
      } catch {
        setMicPermission('denied');
      }
    } else {
      setMicEnabled((prev) => {
        const next = !prev;
        micEnabledRef.current = next;
        if (!next) setLocalMicLevel(0);
        return next;
      });
    }
  }, [ensureAudioOutput, setupMicPipeline]);

  const setVolume = useCallback((peerId, val) => {
    const clamped = Math.max(0, Math.min(2, val));
    setPeerVolumes((prev) => ({ ...prev, [peerId]: clamped }));
  }, []);

  const setMasterVolume = useCallback((val) => {
    const clamped = Math.max(0, Math.min(2, val));
    setMasterVolumeState(clamped);
    localStorage.setItem('macho_voice_vol', String(clamped));
  }, []);

  return {
    micEnabled: micEnabled && Boolean(voicePerms?.canSpeak),
    userMicWanted: micEnabled,
    micPermission,
    localMicLevel,
    speakingPeers,
    peerVolumes,
    masterVolume,
    toggleMic,
    setVolume,
    setMasterVolume,
  };
}
