import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { supabase } from "@/services/supabase/client";
import { Button } from "@/components/primitives/Button";

export const TelemedicineCallPage = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localTracks, setLocalTracks] = useState<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(true);

  useEffect(() => {
    let mounted = true;
    let rtcClient: IAgoraRTCClient | null = null;
    let tracks: [IMicrophoneAudioTrack, ICameraVideoTrack] | null = null;
    const joinCall = async () => {
      try {
        if (!appointmentId) {
          throw new Error("Missing appointmentId");
        }
        const { data, error: tokenError } = await supabase.functions.invoke("agora-token", {
          body: { appointment_id: appointmentId },
        });
        if (tokenError) {
          throw tokenError;
        }

        const { appId, channel, token, uid } = data as { appId: string; channel: string; token: string; uid: number };
        rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

        rtcClient.on("user-published", async (user, mediaType) => {
          await rtcClient.subscribe(user, mediaType);
          if (mediaType === "video" && remoteVideoRef.current) {
            user.videoTrack?.play(remoteVideoRef.current);
          }
          if (mediaType === "audio") {
            user.audioTrack?.play();
          }
        });

        rtcClient.on("user-unpublished", () => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.innerHTML = "";
          }
        });

        await rtcClient.join(appId, channel, token, uid);
        tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
        await rtcClient.publish(tracks);

        if (mounted && localVideoRef.current && tracks) {
          tracks[1].play(localVideoRef.current);
        }

        if (mounted) {
          setClient(rtcClient);
          setLocalTracks(tracks as [IMicrophoneAudioTrack, ICameraVideoTrack]);
          setJoining(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to join call");
          setJoining(false);
        }
      }
    };

    void joinCall();

    return () => {
      mounted = false;
      if (tracks) {
        tracks[0].stop();
        tracks[0].close();
        tracks[1].stop();
        tracks[1].close();
      }
      rtcClient?.leave();
    };
  }, [appointmentId]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Telemedicine Session</h1>
          <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
        </div>

        {joining && <p className="text-sm text-muted-foreground">Joining call...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground mb-2">Your Video</p>
            <div ref={localVideoRef} className="aspect-video bg-muted rounded-md" />
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground mb-2">Remote Video</p>
            <div ref={remoteVideoRef} className="aspect-video bg-muted rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelemedicineCallPage;
